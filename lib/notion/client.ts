import "server-only";
import { Client, APIErrorCode, isNotionClientError, ClientErrorCode } from "@notionhq/client";

// Notion allows ~3 requests/second per integration token. Each token gets a
// small FIFO queue that spaces request starts 340ms apart and caps
// concurrency. 429s are retried by the SDK itself (it honours Retry-After
// with exponential backoff).

const SPACING_MS = 340;
const MAX_IN_FLIGHT = 3;

type Lane = { nextStart: number; inFlight: number; waiting: Array<() => void> };
const lanes = new Map<string, Lane>();

function lane(key: string): Lane {
  let l = lanes.get(key);
  if (!l) {
    l = { nextStart: 0, inFlight: 0, waiting: [] };
    lanes.set(key, l);
  }
  return l;
}

async function acquire(key: string) {
  const l = lane(key);
  if (l.inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => l.waiting.push(r));
  l.inFlight++;
  const now = Date.now();
  const start = Math.max(now, l.nextStart);
  l.nextStart = start + SPACING_MS;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
}

function release(key: string) {
  const l = lane(key);
  l.inFlight--;
  l.waiting.shift()?.();
}

export function notionFor(accessToken: string): Client {
  const key = accessToken.slice(-12);
  return new Client({
    auth: accessToken,
    retry: { maxRetries: 3 },
    timeoutMs: 15_000,
    fetch: async (input, init) => {
      await acquire(key);
      try {
        return await fetch(input, init);
      } finally {
        release(key);
      }
    },
  });
}

export type NotionFailure = { kind: "reauth" | "not_found" | "rate_limited" | "unavailable"; message: string };

/** Classify an error from the SDK into something the UI can act on. */
export function classify(err: unknown): NotionFailure {
  if (isNotionClientError(err)) {
    switch (err.code) {
      case APIErrorCode.Unauthorized:
      case APIErrorCode.RestrictedResource:
        return { kind: "reauth", message: "Your Notion session expired." };
      case APIErrorCode.ObjectNotFound:
        return { kind: "not_found", message: "Dial can't see that Notion page. Was it shared during sign-in?" };
      case APIErrorCode.RateLimited:
        return { kind: "rate_limited", message: "Notion is busy. Retrying shortly." };
      case ClientErrorCode.RequestTimeout:
        return { kind: "unavailable", message: "Notion took too long to answer." };
    }
    return { kind: "unavailable", message: err.message };
  }
  return { kind: "unavailable", message: err instanceof Error ? err.message : "Couldn't reach Notion." };
}
