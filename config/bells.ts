// ─────────────────────────────────────────────────────────────────────────────
//  Bell schedule — Bellaire High School, 2025–2026.
//  Edit this file; no other code needs to change.
//
//  • `course` must match the "Course Name" in Notion exactly. A period whose
//    class isn't in Notion still shows in the header ("Yearbook · 22m left")
//    but has no task list to open.
//  • Times are 24-hour "HH:MM" in `timezone`.
//  • Blocks without a class (Cardinal Hour / lunch) use `course: null`; they
//    count as passing time before the next class.
// ─────────────────────────────────────────────────────────────────────────────

export type Period = { period: string; start: string; end: string; course: string | null };

export const timezone = "America/Chicago";

/** School is over for the day at this time (the "Tonight" view takes over). */
export const schoolEnds = "16:00";

export const schedules = {
  regular: [
    { period: "0", start: "07:30", end: "08:22", course: "Debate" },
    { period: "1", start: "08:30", end: "09:21", course: "Yearbook" },
    { period: "2", start: "09:27", end: "10:23", course: "AP Chinese" },
    { period: "3", start: "10:29", end: "11:20", course: "Pre-Calc" },
    { period: "4", start: "11:26", end: "12:17", course: "Chemistry" },
    { period: "Cardinal Hour", start: "12:21", end: "13:09", course: null },
    { period: "5", start: "13:15", end: "14:06", course: "AP World History (WHAP)" },
    { period: "6", start: "14:12", end: "15:03", course: "Computer Science 1A" },
    { period: "7", start: "15:09", end: "16:00", course: "English" },
  ],
} satisfies Record<string, Period[]>;

export type DayType = keyof typeof schedules;

/**
 * Which schedule a weekday uses. For an A/B rotation, add `a` and `b`
 * schedules above and return them here (e.g. by counting school days from a
 * known A day). Weekends are handled separately and never reach this.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const dayType = (date: Date): DayType => "regular";

/**
 * Per-date overrides, keyed by local date "YYYY-MM-DD".
 * Use a schedule name for odd days, or "none" for holidays.
 */
export const overrides: Record<string, DayType | "none"> = {
  // "2026-11-25": "regular",
  // "2026-11-26": "none", // Thanksgiving
};
