import type { Transition } from "motion/react";

// Motion tokens from DESIGN.md. Nothing in the app uses linear easing.
export const spring = {
  ui: { type: "spring", stiffness: 400, damping: 32, mass: 0.8 } satisfies Transition,
  wheel: { type: "spring", stiffness: 260, damping: 26 } satisfies Transition,
};

export const easeOut = [0.2, 0.8, 0.2, 1] as const;

export const fade: Transition = { duration: 0.2, ease: easeOut };
export const fadeFast: Transition = { duration: 0.15, ease: easeOut };
