"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../types";

const CACHE_KEY = "dial.snapshot.v1";
const POLL_MS = 60_000;

export type SyncState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "offline" };

function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}
function writeCache(s: Snapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: cache is a convenience only */
  }
}
export function clearSnapshotCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

/**
 * Paints from the last snapshot in localStorage immediately, then fetches
 * fresh data and swaps it in silently. Polls every 60s while the tab is
 * visible, and on focus/online. Auth failures leave the page.
 */
export type LoadedSnapshot = Snapshot & { requestedAt?: number };

export function useSnapshot(initial: LoadedSnapshot | null = null) {
  const [data, setData] = useState<LoadedSnapshot | null>(initial);
  const [sync, setSync] = useState<SyncState>(initial ? { kind: "idle" } : { kind: "loading" });
  const inFlight = useRef(false);
  const scenario = useRef<string | null>(null);
  const seeded = useRef(initial);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSync({ kind: "offline" });
      return;
    }
    inFlight.current = true;
    try {
      const params = new URLSearchParams();
      if (scenario.current) params.set("scenario", scenario.current);
      const nowParam = new URLSearchParams(window.location.search).get("now");
      if (nowParam) params.set("now", nowParam);
      const qs = params.size ? `?${params}` : "";
      const requestedAt = Date.now();
      const res = await fetch(`/api/data${qs}`, { cache: "no-store" });
      if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        clearSnapshotCache();
        window.location.replace(body.error === "reauth" ? "/auth/expired" : "/");
        return;
      }
      if (res.status === 409) {
        window.location.replace("/onboarding");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setSync({ kind: "error", message: body.message ?? "Couldn't reach Notion." });
        return;
      }
      const snap = (await res.json()) as Snapshot;
      setData({ ...snap, requestedAt });
      setSync({ kind: "idle" });
      if (!snap.demo) writeCache(snap);
    } catch {
      setSync(navigator.onLine ? { kind: "error", message: "Couldn't reach Notion." } : { kind: "offline" });
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    scenario.current = new URLSearchParams(window.location.search).get("scenario");
    const seed = seeded.current;
    // HTML older than 30s came from the service worker's offline copy (or bfcache).
    const fresh = seed && Date.now() - (seed.requestedAt ?? 0) < 30_000;
    if (seed && fresh) {
      // Server-rendered with fresh data: just keep the offline cache warm.
      if (!seed.demo) writeCache(seed);
    } else {
      // Static shell only (Notion hiccup) or stale HTML: paint from the
      // newest snapshot we have, then fetch.
      const cached = scenario.current ? null : readCache();
      if (cached && (!seed || cached.fetchedAt > seed.fetchedAt)) setData(cached);
      void load();
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else stop();
    };
    const onOnline = () => void load();
    const onOffline = () => setSync({ kind: "offline" });

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [load]);

  return { data, sync, reload: load };
}
