"use client";

// Deferred work (the date parser, the sheets) loads on the first sign of
// use — a touch, key or focus — or once the page has sat quiet for a while,
// so it's cached before you go offline. Either way it stays out of the
// first few seconds, where it would compete with hydration.

const QUIET_MS = 8000;
const EVENTS = ["pointerdown", "keydown", "focusin"] as const;

let fired = false;
let armed = false;
const callbacks = new Set<() => void>();

function fire() {
  if (fired) return;
  fired = true;
  for (const e of EVENTS) window.removeEventListener(e, fire, true);
  for (const cb of callbacks) cb();
  callbacks.clear();
}

function arm() {
  if (armed) return;
  armed = true;
  for (const e of EVENTS) window.addEventListener(e, fire, { capture: true, passive: true });
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(fire, { timeout: 2000 }) : fire()), QUIET_MS);
}

/** Runs `cb` once the app is "warm". Returns an unsubscribe. */
export function onWarm(cb: () => void): () => void {
  if (fired) {
    cb();
    return () => {};
  }
  callbacks.add(cb);
  arm();
  return () => callbacks.delete(cb);
}
