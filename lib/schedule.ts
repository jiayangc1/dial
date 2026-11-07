import { schedules } from "@/config/bells";
import type { Course } from "./types";

/** Course names in the order they first appear across the bell schedules. */
export function scheduleOrder(): string[] {
  const seen: string[] = [];
  for (const day of Object.values(schedules)) {
    for (const p of day) if (p.course && !seen.includes(p.course)) seen.push(p.course);
  }
  return seen;
}

/** Wheel order: period order first, then any unscheduled classes A→Z. */
export function orderCourses(courses: Course[]): Course[] {
  const order = scheduleOrder();
  const rank = (c: Course) => {
    const i = order.indexOf(c.name);
    return i === -1 ? order.length : i;
  };
  return [...courses].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Schedule names that don't match an enrolled Notion course, and vice versa. */
export function scheduleMismatches(courses: Course[]) {
  const names = new Set(courses.map((c) => c.name));
  const order = scheduleOrder();
  return {
    unknownInSchedule: order.filter((n) => !names.has(n)),
    unscheduled: courses.filter((c) => !order.includes(c.name)).map((c) => c.name),
  };
}
