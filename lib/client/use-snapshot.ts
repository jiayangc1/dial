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
export function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [sync, setSync] = useState<SyncState>({ kind: "loading" });
  const inFlight = useRef(false);
  const scenario = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSync({ kind: "offline" });
      return;
    }
    inFlight.current = true;
    try {
      const qs = scenario.current ? `?scenario=${encodeURIComponent(scenario.current)}` : "";
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
      setData(snap);
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
    const cached = scenario.current ? null : readCache();
    // Hydrate from cache after mount (localStorage isn't available on the server).
    if (cached) setData(cached);
    void load();

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
