"use client";

import { BookOpen, Brain, CalendarCheck, ClipboardCheck, NotebookPen, Shapes, CircleDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dueLabel, minutesLabel } from "@/lib/format";
import type { Task, TaskType } from "@/lib/types";

export const TYPE_ICON: Record<TaskType, LucideIcon> = {
  Homework: NotebookPen,
  "Test / Quiz": ClipboardCheck,
  Project: Shapes,
  Reading: BookOpen,
  Study: Brain,
  Other: CircleDashed,
};

export function TaskRow({ task, now }: { task: Task; now: Date }) {
  const due = dueLabel(task.due, now);
  const Icon = task.type ? TYPE_ICON[task.type] : null;
  const mins = minutesLabel(task.minutes);
  const done = task.statusGroup === "complete";
  const inProgress = task.statusGroup === "in_progress";

  return (
    <div className="group flex min-h-14 items-start gap-3 rounded-card px-3 py-3 hover:bg-gray-100" style={{ transition: "background-color 150ms var(--ease-out)" }}>
      {/* Checkbox. Interactive from stage 3; decorative for now. */}
      <span
        aria-hidden="true"
        className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          done ? "border-accent bg-accent" : inProgress ? "border-accent" : "border-gray-500"
        }`}
      >
        {inProgress && !done && <span className="size-2 rounded-full bg-accent opacity-60" />}
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-on-accent">
            <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 text-body ${done ? "text-gray-900 line-through decoration-gray-600" : "text-gray-1000"}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-gray-900">
          {due && (
            <span title={due.exact} className={`tabular ${due.overdue && !done ? "font-medium text-red" : ""}`}>
              {due.text}
            </span>
          )}
          {Icon && (
            <span className="flex items-center gap-1">
              <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{task.type}</span>
            </span>
          )}
          {mins && <span className="font-mono text-label tabular">{mins}</span>}
          {inProgress && <span>{task.status}</span>}
          {task.calendarEvent && (
            <a
              href={task.calendarEvent}
              target="_blank"
              rel="noreferrer"
              className="pressable -my-1 flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 hover:text-gray-1000"
              title={task.scheduledFor ? `Scheduled ${dueLabel(task.scheduledFor, now)?.exact ?? ""}` : "On your calendar"}
            >
              <CalendarCheck size={12} strokeWidth={1.5} aria-hidden="true" />
              on calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
