"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * Digits roll like an odometer when they change. Each character sits in a
 * fixed-width, clipped slot (Geist Mono + tabular nums), so nothing reflows.
 * `direction` is -1 for a countdown (digits roll down).
 */
export function Odometer({ value, direction = -1, className = "" }: { value: string; direction?: 1 | -1; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={`inline-flex font-mono tabular ${className}`} aria-hidden="true">
      {value.split("").map((ch, i) => (
        <span key={`${value.length}-${i}`} className="relative inline-block h-[1.2em] overflow-hidden" style={{ width: "1ch" }}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              className="absolute inset-x-0 top-0 text-center leading-[1.2em]"
              initial={reduced ? { opacity: 0 } : { y: `${-100 * direction}%`, opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: `${100 * direction}%`, opacity: 0 }}
              transition={reduced ? { duration: 0.15 } : spring.ui}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
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
