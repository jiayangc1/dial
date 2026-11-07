import type { CSSProperties } from "react";

// Google Calendar event colours, tuned per theme so each one clears 3:1 as a UI
// colour against the Geist background (#0a0a0a dark, #ffffff light). `on` is
// the text/icon colour used on a solid accent fill (checkbox, FAB).

export type Accent = { dark: string; light: string; onDark: string; onLight: string };

const BLACK = "#0a0a0a";
const WHITE = "#ffffff";

export const CALENDAR_COLORS: Record<string, Accent> = {
  //            Google hex   dark tuned     light tuned
  Lavender: { dark: "#8e9ae6", light: "#5563b8", onDark: BLACK, onLight: WHITE }, // #7986CB
  Sage: { dark: "#3dc287", light: "#1b7f52", onDark: BLACK, onLight: WHITE }, // #33B679
  Grape: { dark: "#c06ad9", light: "#8e24aa", onDark: BLACK, onLight: WHITE }, // #8E24AA
  Flamingo: { dark: "#ee8a82", light: "#c4483e", onDark: BLACK, onLight: WHITE }, // #E67C73
  Banana: { dark: "#f6c744", light: "#9a6b00", onDark: BLACK, onLight: WHITE }, // #F6BF26
  Tangerine: { dark: "#ff7043", light: "#d4400f", onDark: BLACK, onLight: WHITE }, // #F4511E
  Peacock: { dark: "#29b6f6", light: "#0277bd", onDark: BLACK, onLight: WHITE }, // #039BE5
  Graphite: { dark: "#9e9e9e", light: "#616161", onDark: BLACK, onLight: WHITE }, // #616161
  Blueberry: { dark: "#7c8cf0", light: "#3f51b5", onDark: BLACK, onLight: WHITE }, // #3F51B5
  Basil: { dark: "#34b36b", light: "#0b8043", onDark: BLACK, onLight: WHITE }, // #0B8043
  Tomato: { dark: "#ff5c5c", light: "#c40000", onDark: BLACK, onLight: WHITE }, // #D50000
};

export const NEUTRAL: Accent = { dark: "#a1a1a1", light: "#666666", onDark: BLACK, onLight: WHITE };

/** "Tangerine (6)" → "Tangerine". Returns null for missing/unknown values. */
export function colorName(select: string | null | undefined): string | null {
  if (!select) return null;
  const name = select.replace(/\s*\(\d+\)\s*$/, "").trim();
  return name in CALENDAR_COLORS ? name : null;
}

export function accentFor(name: string | null | undefined): Accent {
  return (name && CALENDAR_COLORS[name]) || NEUTRAL;
}

/**
 * CSS custom properties for a subtree that should use this accent. Uses
 * light-dark() so the right variant follows the system theme with no JS.
 */
export function accentStyle(name: string | null | undefined): CSSProperties {
  const a = accentFor(name);
  return {
    "--accent": `light-dark(${a.light}, ${a.dark})`,
    "--on-accent": `light-dark(${a.onLight}, ${a.onDark})`,
  } as CSSProperties;
}
