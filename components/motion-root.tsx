"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const features = () => import("@/lib/motion-features").then((m) => m.default);

/**
 * Every animated tree sits under this. Components use the slim `m.*`
 * elements; the animation engine loads asynchronously, so server-rendered
 * markup paints and hydrates without it. Honours the OS reduced-motion setting.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
