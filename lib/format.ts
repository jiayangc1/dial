import { timezone } from "@/config/bells";
import { dueInstant, startOfDay } from "./time";
import type { NotionDate } from "./types";

export type DueLabel = { text: string; overdue: boolean; exact: string; soon: boolean };

const exactFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" });
const exactTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: timezone,
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });

/**
 * Relative due labels: "Overdue", "in 2h", "Today", "Tomorrow", "Thu",
 * "Nov 21". `soon` marks anything due within 48 hours (the "Due soon" group).
 */
export function dueLabel(due: NotionDate, now = new Date()): DueLabel | null {
  if (!due) return null;
  const allDay = due.start.length === 10;
  const at = dueInstant(due.start, timezone);
  const exact = allDay ? exactFmt.format(at) : exactTimeFmt.format(at);
  const ms = at.getTime() - now.getTime();
  const soon = ms < 48 * 3600_000;

  if (ms < 0) return { text: "Overdue", overdue: true, exact, soon: true };

  const today = startOfDay(now, timezone).getTime();
  const dayIdx = Math.floor((startOfDay(at, timezone).getTime() - today) / 86_400_000 + 0.5);

  if (!allDay && ms < 6 * 3600_000) {
    const h = Math.floor(ms / 3600_000);
    const text = h >= 1 ? `in ${h}h` : `in ${Math.max(1, Math.round(ms / 60_000))}m`;
    return { text, overdue: false, exact, soon };
  }
  if (dayIdx === 0) return { text: allDay ? "Today" : `Today ${timeFmt.format(at)}`, overdue: false, exact, soon };
  if (dayIdx === 1) return { text: "Tomorrow", overdue: false, exact, soon };
  if (dayIdx < 7) return { text: weekdayFmt.format(at), overdue: false, exact, soon };
  return { text: monthDayFmt.format(at), overdue: false, exact, soon };
}

export function minutesLabel(m: number | null): string | null {
  if (!m) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
