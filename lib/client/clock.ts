"use client";

import { useEffect, useState } from "react";
import { timezone } from "@/config/bells";
import { fromZoned } from "../time";

// A 1Hz clock aligned to the second boundary. `?now=2026-11-09T09:19:50`
// (school-local wall time) shifts it, and time keeps flowing from there.
// That's how the design review captures every "now" state, including a
// period ending live.

let offset: number | null = null;
function getOffset() {
  if (offset !== null) return offset;
  offset = 0;
  try {
    const raw = new URLSearchParams(window.location.search).get("now");
    const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const at = fromZoned(+m[1], +m[2], +m[3], +m[4], +m[5], timezone).getTime() + (m[6] ? +m[6] * 1000 : 0);
      offset = at - Date.now();
    }
  } catch {}
  return offset;
}

export function clockNow() {
  return new Date(Date.now() + getOffset());
}

/**
 * `initial` is the server's clock for the server-rendered first view, so the
 * first client render matches the HTML exactly; real time takes over after mount.
 */
export function useClock(initial?: number | null): Date | null {
  const [now, setNow] = useState<Date | null>(() => (initial != null ? new Date(initial) : null));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = clockNow();
      setNow(d);
      timer = setTimeout(tick, 1000 - (d.getTime() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/**
 * Minute-precision clock for everything except the countdown. Bell times
 * are whole minutes, so "now" state and due labels only change on the
 * minute; re-rendering the task list every second would waste the frame
 * budget (and re-measure every layout-animated row).
 */
export function useMinuteClock(initial?: number | null): Date | null {
  const [now, setNow] = useState<Date | null>(() => (initial != null ? new Date(initial) : null));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = clockNow();
      // Same minute as the server render: keep the object so nothing re-renders.
      setNow((prev) => (prev && Math.floor(prev.getTime() / 60_000) === Math.floor(d.getTime() / 60_000) ? prev : d));
      timer = setTimeout(tick, 60_000 - (d.getTime() % 60_000) + 20);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
