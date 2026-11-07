// ─────────────────────────────────────────────────────────────────────────────
//  Bell schedule. Edit this file; no other code needs to change.
//
//  • `course` must match the "Course Name" in Notion exactly.
//  • Times are 24-hour "HH:MM" in `timezone`.
//  • Periods without a course (lunch, advisory) can use `course: null`.
//
//  ⚠️  The `regular` schedule below is an EXAMPLE so the app has something to
//      show. Replace it with your real bell times.
// ─────────────────────────────────────────────────────────────────────────────

export type Period = { period: string; start: string; end: string; course: string | null };

export const timezone = "America/Chicago";

/** School is over for the day at this time (the "Tonight" view takes over). */
export const schoolEnds = "16:00";

export const schedules = {
  regular: [
    { period: "1", start: "08:30", end: "09:20", course: "Pre-Calc" },
    { period: "2", start: "09:25", end: "10:15", course: "AP Chinese" },
    { period: "3", start: "10:20", end: "11:10", course: "AP World History (WHAP)" },
    { period: "Lunch", start: "11:10", end: "11:45", course: null },
    { period: "4", start: "11:50", end: "12:40", course: "Chemistry" },
    { period: "5", start: "12:45", end: "13:35", course: "AP Physics 1" },
    { period: "6", start: "13:40", end: "14:30", course: "Computer Science 1A" },
    { period: "7", start: "14:35", end: "15:25", course: "Debate" },
  ],
  earlyRelease: [
    { period: "1", start: "08:30", end: "09:00", course: "Pre-Calc" },
    { period: "2", start: "09:05", end: "09:35", course: "AP Chinese" },
    { period: "3", start: "09:40", end: "10:10", course: "AP World History (WHAP)" },
    { period: "4", start: "10:15", end: "10:45", course: "Chemistry" },
    { period: "5", start: "10:50", end: "11:20", course: "AP Physics 1" },
    { period: "6", start: "11:25", end: "11:55", course: "Computer Science 1A" },
    { period: "7", start: "12:00", end: "12:30", course: "Debate" },
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
  // "2026-11-25": "earlyRelease",
  // "2026-11-26": "none", // Thanksgiving
};
