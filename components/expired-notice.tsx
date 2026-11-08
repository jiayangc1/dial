"use client";

import { useSearchParams } from "next/navigation";

export function ExpiredNotice() {
  const expired = useSearchParams().has("expired");
  if (!expired) return null;
  return (
    <p role="status" className="fade-up surface mt-6 rounded-full px-4 py-2 text-small text-gray-1000">
      Your Notion session expired. Sign in again to pick up where you left off.
    </p>
  );
}
