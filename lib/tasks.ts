import { timezone } from "@/config/bells";
import { dueInstant } from "./time";
import type { Priority, Task } from "./types";

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

/** Due date ascending (undated last), then priority High → Low, then title. */
export function compareTasks(a: Task, b: Task): number {
  const da = a.due ? dueInstant(a.due.start, timezone).getTime() : Infinity;
  const db = b.due ? dueInstant(b.due.start, timezone).getTime() : Infinity;
  if (da !== db) return da - db;
  const pa = PRIORITY_RANK[a.priority ?? "Medium"];
  const pb = PRIORITY_RANK[b.priority ?? "Medium"];
  return pa - pb || a.title.localeCompare(b.title);
}

export type Grouped = { soon: Task[]; later: Task[]; done: Task[] };

/** "Due soon" = overdue or due within 48h. Done = completed this week. */
export function groupTasks(tasks: Task[], courseId: string, now = new Date()): Grouped {
  const horizon = now.getTime() + 48 * 3600_000;
  const out: Grouped = { soon: [], later: [], done: [] };
  for (const t of tasks) {
    if (!t.courseIds.includes(courseId)) continue;
    if (t.statusGroup === "complete") out.done.push(t);
    else if (t.due && dueInstant(t.due.start, timezone).getTime() <= horizon) out.soon.push(t);
    else out.later.push(t);
  }
  out.soon.sort(compareTasks);
  out.later.sort(compareTasks);
  out.done.sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
  return out;
}

/** Card stats: open count, next due task, and this week's completion share. */
export function courseStats(tasks: Task[], courseId: string, weekStart: Date, weekEnd: Date) {
  let open = 0;
  let next: Task | null = null;
  let weekTotal = 0;
  let weekDone = 0;
  for (const t of tasks) {
    if (!t.courseIds.includes(courseId)) continue;
    const isDone = t.statusGroup === "complete";
    if (!isDone) {
      open++;
      if (t.due && (!next || compareTasks(t, next) < 0)) next = t;
    }
    const at = t.due ? dueInstant(t.due.start, timezone) : null;
    const thisWeek = at && at >= weekStart && at < weekEnd;
    if (thisWeek || (isDone && !t.due)) {
      weekTotal++;
      if (isDone) weekDone++;
    }
  }
  return { open, next, weekTotal, weekDone, progress: weekTotal ? weekDone / weekTotal : 0 };
}
