import { timezone } from "@/config/bells";
import { dueInstant, startOfDay, zonedParts } from "./time";
import type { NotionDate } from "./types";

export type DueLabel = { text: string; overdue: boolean; exact: string; soon: boolean };

// Built from zonedParts' one cached formatter rather than five Intl
// formatters of its own: constructing each one costs real time on a phone,
// and this module loads during hydration.
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function clock(h: number, m: number) {
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
/** "Thursday, November 20" or "Thursday, November 20 at 3:00 PM" */
function exactLabel(at: Date, withTime: boolean) {
  const z = zonedParts(at, timezone);
  const day = `${DAYS[z.weekday]}, ${MONTHS[z.month - 1]} ${z.day}`;
  return withTime ? `${day} at ${clock(z.hour, z.minute)}` : day;
}

/**
 * Relative due labels: "Overdue", "in 2h", "Today", "Tomorrow", "Thu",
 * "Nov 21". `soon` marks anything due within 48 hours (the "Due soon" group).
 */
export function dueLabel(due: NotionDate, now = new Date()): DueLabel | null {
  if (!due) return null;
  const allDay = due.start.length === 10;
  const at = dueInstant(due.start, timezone);
  const exact = exactLabel(at, !allDay);
  const z = zonedParts(at, timezone);
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
  if (dayIdx === 0) return { text: allDay ? "Today" : `Today ${clock(z.hour, z.minute)}`, overdue: false, exact, soon };
  if (dayIdx === 1) return { text: "Tomorrow", overdue: false, exact, soon };
  if (dayIdx < 7) return { text: DAYS[z.weekday].slice(0, 3), overdue: false, exact, soon };
  return { text: `${MONTHS[z.month - 1].slice(0, 3)} ${z.day}`, overdue: false, exact, soon };
}

export function minutesLabel(m: number | null): string | null {
  if (!m) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
