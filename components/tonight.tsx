"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon } from "lucide-react";
import { TaskRow, type RowActions } from "./task-row";
import { compareTasks } from "@/lib/tasks";
import { dueInstant } from "@/lib/time";
import { timezone } from "@/config/bells";
import { fade, spring } from "@/lib/motion";
import type { NowState } from "@/lib/now";
import type { ClientTask } from "@/lib/client/task-store";
import type { Course } from "@/lib/types";

const TITLES: Partial<Record<NowState["kind"], { title: string; sub: string }>> = {
  after_school: { title: "Tonight", sub: "Everything due in the next 48 hours" },
  before_school: { title: "Before school", sub: "Due in the next 48 hours, across every class" },
  weekend: { title: "This weekend", sub: "Due in the next 48 hours" },
  no_school: { title: "No school today", sub: "Due in the next 48 hours" },
};

/** Before/after school, weekends and days off: what's due soon across all classes. */
export function Tonight({
  state,
  tasks,
  courses,
  now,
  actions,
}: {
  state: NowState;
  tasks: ClientTask[];
  courses: Map<string, Course>;
  now: Date;
  actions: RowActions;
}) {
  const head = TITLES[state.kind] ?? TITLES.after_school!;
  const horizon = now.getTime() + 48 * 3600_000;
  const due = tasks
    .filter((t) => t.statusGroup !== "complete" && t.due && dueInstant(t.due.start, timezone).getTime() <= horizon && t.courseIds.some((id) => courses.has(id)))
    .sort(compareTasks);
  const minutes = due.reduce((s, t) => s + (t.minutes ?? 0), 0);

  return (
    <section aria-labelledby="tonight-h" className="pb-2 pt-6">
      <div className="flex items-end justify-between gap-4 px-3">
        <div>
          <h1 id="tonight-h" className="text-title font-semibold tracking-[-0.02em] text-gray-1000">
            {head.title}
          </h1>
          <p className="mt-1 text-small text-gray-900">{head.sub}</p>
        </div>
        {due.length > 0 && (
          <p className="shrink-0 text-right text-small text-gray-900">
            <span className="font-mono tabular text-gray-1000">{due.length}</span> due
            {minutes > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular text-gray-1000">{minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}` : `${minutes}m`}</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="mt-3">
        {due.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade} className="flex items-center gap-3 px-3 py-4 text-body text-gray-900">
            <Moon size={20} strokeWidth={1.5} /> Nothing due in the next two days. Enjoy it.
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {due.map((t) => (
              <motion.div
                key={t.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.ui}
                className="overflow-hidden"
              >
                <TaskRow task={t} now={now} actions={actions} course={courses.get(t.courseIds[0])} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
