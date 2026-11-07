"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";

export function ExpiredNotice() {
  const expired = useSearchParams().has("expired");
  if (!expired) return null;
  return (
    <motion.p
      role="status"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="surface mt-6 rounded-full px-4 py-2 text-small text-gray-1000"
    >
      Your Notion session expired. Sign in again to pick up where you left off.
    </motion.p>
  );
}
