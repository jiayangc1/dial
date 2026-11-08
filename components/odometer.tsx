"use client";

import { useState } from "react";

/**
 * Digits roll like an odometer when they change. Each character sits in a
 * fixed-width, clipped slot (Geist Mono + tabular nums), so nothing reflows.
 * `direction` is -1 for a countdown (digits roll down).
 *
 * CSS animations, not Motion: the header countdown re-renders every second,
 * and this keeps each tick off the main thread.
 */
export function Odometer({ value, direction = -1, className = "" }: { value: string; direction?: 1 | -1; className?: string }) {
  return (
    <span className={`inline-flex font-mono tabular ${className}`} aria-hidden="true" style={{ "--odo-dir": direction } as React.CSSProperties}>
      {value.split("").map((ch, i) => (
        <Digit key={`${value.length}-${i}`} ch={ch} />
      ))}
    </span>
  );
}

function Digit({ ch }: { ch: string }) {
  // The outgoing character stays mounted to roll out while the new one rolls in.
  const [state, setState] = useState({ cur: ch, prev: null as string | null, n: 0 });
  if (state.cur !== ch) setState({ cur: ch, prev: state.cur, n: state.n + 1 });
  return (
    <span className="relative inline-block h-[1.2em] overflow-hidden" style={{ width: "1ch" }}>
      {state.prev !== null && (
        <span key={`out-${state.n}`} className="odo-out absolute inset-x-0 top-0 text-center leading-[1.2em]">
          {state.prev}
        </span>
      )}
      <span key={`in-${state.n}`} className={`${state.n ? "odo-in" : ""} absolute inset-x-0 top-0 text-center leading-[1.2em]`}>
        {state.cur}
      </span>
    </span>
  );
}

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
