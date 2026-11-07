// "What's happening right now?" Pure function of (instant, bell config), so it
// runs identically on server, client and in node:test. No path aliases here:
// this file is imported directly by the test runner.
import { dateKey, fromZoned, hm, minutesOfDay, zonedParts } from "./time.ts";

export type Period = { period: string; start: string; end: string; course: string | null };

export type BellConfig = {
  timezone: string;
  schoolEnds: string;
  schedules: Record<string, Period[]>;
  dayType: (date: Date) => string;
  overrides: Record<string, string>;
};

export type TimedPeriod = Period & { startsAt: Date; endsAt: Date };

export type NowState =
  /** In a period that has a course. */
  | { kind: "in_class"; period: TimedPeriod; course: string; next: TimedPeriod | null }
  /** Between periods (or at lunch / a course-less period): show the next class. */
  | { kind: "passing"; next: TimedPeriod & { course: string }; from: TimedPeriod | null }
  /** Before the first period. */
  | { kind: "before_school"; first: TimedPeriod | null }
  /** After the last class. */
  | { kind: "after_school" }
  | { kind: "weekend" }
  /** A weekday with no school (override "none"). */
  | { kind: "no_school" };

/** How close to first bell a morning counts as "passing" rather than "before school". */
export const MORNING_PASSING_MIN = 10;

/** Which schedule (if any) applies on the local date containing `date`. */
export function scheduleFor(date: Date, cfg: BellConfig): { name: string; periods: Period[] } | null {
  const key = dateKey(date, cfg.timezone);
  const override = cfg.overrides[key];
  if (override === "none") return null;
  if (override && cfg.schedules[override]) return { name: override, periods: cfg.schedules[override] };
  const { weekday } = zonedParts(date, cfg.timezone);
  if (weekday === 0 || weekday === 6) return null;
  const name = cfg.dayType(date);
  const periods = cfg.schedules[name];
  return periods ? { name, periods } : null;
}

function timed(date: Date, p: Period, tz: string): TimedPeriod {
  const z = zonedParts(date, tz);
  const [sh, sm] = p.start.split(":").map(Number);
  const [eh, em] = p.end.split(":").map(Number);
  return { ...p, startsAt: fromZoned(z.year, z.month, z.day, sh, sm, tz), endsAt: fromZoned(z.year, z.month, z.day, eh, em, tz) };
}

export function nowState(date: Date, cfg: BellConfig): NowState {
  const tz = cfg.timezone;
  const day = scheduleFor(date, cfg);
  if (!day) {
    const { weekday } = zonedParts(date, tz);
    return weekday === 0 || weekday === 6 ? { kind: "weekend" } : { kind: "no_school" };
  }

  const periods = [...day.periods].sort((a, b) => hm(a.start) - hm(b.start));
  const m = minutesOfDay(date, tz);
  const withCourse = periods.filter((p): p is Period & { course: string } => !!p.course);
  if (withCourse.length === 0) return { kind: "no_school" };

  const first = periods[0];
  if (m < hm(first.start)) {
    const firstClass = withCourse[0];
    if (hm(firstClass.start) - m <= MORNING_PASSING_MIN) {
      return { kind: "passing", next: timed(date, firstClass, tz) as TimedPeriod & { course: string }, from: null };
    }
    return { kind: "before_school", first: timed(date, firstClass, tz) };
  }

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (m >= hm(p.start) && m < hm(p.end)) {
      const nextClass = withCourse.find((q) => hm(q.start) >= hm(p.end)) ?? null;
      if (p.course) {
        return { kind: "in_class", period: timed(date, p, tz), course: p.course, next: nextClass ? timed(date, nextClass, tz) : null };
      }
      // Lunch / advisory: behaves like a long passing period.
      if (nextClass) return { kind: "passing", next: timed(date, nextClass, tz) as TimedPeriod & { course: string }, from: timed(date, p, tz) };
      return { kind: "after_school" };
    }
  }

  // Between periods, or after the last one.
  const nextClass = withCourse.find((q) => hm(q.start) > m);
  if (nextClass) {
    const prev = [...periods].reverse().find((q) => hm(q.end) <= m) ?? null;
    return { kind: "passing", next: timed(date, nextClass, tz) as TimedPeriod & { course: string }, from: prev ? timed(date, prev, tz) : null };
  }
  return { kind: "after_school" };
}

/** The course the wheel should centre on, or null for the "Tonight" views. */
export function focusCourse(s: NowState): string | null {
  if (s.kind === "in_class") return s.course;
  if (s.kind === "passing") return s.next.course;
  return null;
}

export function isTonight(s: NowState): boolean {
  return s.kind === "before_school" || s.kind === "after_school" || s.kind === "weekend" || s.kind === "no_school";
}

/** Milliseconds until the state could next change (for scheduling a re-check). */
export function msUntilChange(s: NowState, date: Date): number | null {
  if (s.kind === "in_class") return s.period.endsAt.getTime() - date.getTime();
  if (s.kind === "passing") return s.next.startsAt.getTime() - date.getTime();
  if (s.kind === "before_school" && s.first) return s.first.startsAt.getTime() - MORNING_PASSING_MIN * 60_000 - date.getTime();
  return null;
}
