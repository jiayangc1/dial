"use client";

import { motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Small accent ring showing the share of this week's tasks that are done. */
export function ProgressRing({ value, size = 20, label }: { value: number; size?: number; label?: string }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(value * 100)}% done this week`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline-strong)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: Math.max(value, 0.001), opacity: value > 0 ? 1 : 0 }}
        transition={spring.ui}
      />
    </svg>
  );
}
