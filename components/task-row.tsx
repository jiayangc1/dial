"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { BookOpen, Brain, CalendarCheck, CalendarDays, Check, ClipboardCheck, NotebookPen, Send, Shapes, CircleDashed, Timer, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dueLabel, minutesLabel } from "@/lib/format";
import { spring, easeOut } from "@/lib/motion";
import { accentStyle } from "@/lib/colors";
import type { ClientTask } from "@/lib/client/task-store";
import type { Course, TaskType } from "@/lib/types";

export const TYPE_ICON: Record<TaskType, LucideIcon> = {
  Homework: NotebookPen,
  "Test / Quiz": ClipboardCheck,
  Project: Shapes,
  Reading: BookOpen,
  Study: Brain,
  Other: CircleDashed,
};

export type RowActions = {
  onComplete: (t: ClientTask) => void;
  onReopen: (t: ClientTask) => void;
  onOpen: (t: ClientTask, focus?: "due") => void;
  onStatus: (t: ClientTask, status: "In progress" | "Need to Submit") => void;
  onDelete: (t: ClientTask) => void;
};

const COMMIT = 88; // px of right swipe that completes
const ACTION_W = 60;
const TRAY = ACTION_W * 4;

const haptic = () => {
  try {
    navigator.vibrate?.(8);
  } catch {}
};

export function TaskRow({ task, now, actions, course }: { task: ClientTask; now: Date; actions: RowActions; course?: Course }) {
  const reduced = useReducedMotion() ?? false;
  const [completing, setCompleting] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [armed, setArmed] = useState<"complete" | "tray" | null>(null);
  const dragging = useRef(false);
  const x = useMotionValue(0);
  const done = task.statusGroup === "complete";
  const inProgress = task.statusGroup === "in_progress";

  const completeOpacity = useTransform(x, [0, 24, COMMIT], [0, 0.4, 1]);
  const trayOpacity = useTransform(x, [-TRAY, -24, 0], [1, 0.6, 0]);

  const complete = () => {
    if (completing) return;
    if (done) {
      actions.onReopen(task);
      return;
    }
    haptic();
    setCompleting(true);
  };

  useEffect(() => {
    if (!completing) return;
    const t = setTimeout(() => actions.onComplete(task), reduced ? 150 : 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completing]);

  const closeTray = () => {
    setTrayOpen(false);
    animate(x, 0, spring.ui);
  };

  const due = dueLabel(task.due, now);
  const Icon = task.type ? TYPE_ICON[task.type] : null;
  const mins = minutesLabel(task.minutes);
  const showDone = done || completing;

  return (
    <div className="relative overflow-hidden rounded-card" style={course ? accentStyle(course.color) : undefined}>
      {/* Right swipe: complete. The accent fills in progressively behind the row. */}
      <motion.div aria-hidden="true" className="absolute inset-0 flex items-center rounded-card bg-accent pl-5" style={{ opacity: completeOpacity }}>
        <motion.span animate={{ scale: armed === "complete" ? 1.25 : 0.85 }} transition={spring.ui} className="text-on-accent">
          <Check size={20} strokeWidth={2} />
        </motion.span>
      </motion.div>

      {/* Left swipe: quick actions tray. */}
      <motion.div className="absolute inset-y-0 right-0 flex" style={{ opacity: trayOpacity, width: TRAY }} aria-hidden={!trayOpen}>
        <TrayButton icon={Timer} label="Doing" onClick={() => (closeTray(), actions.onStatus(task, "In progress"))} tabbable={trayOpen} />
        <TrayButton icon={Send} label="Submit" onClick={() => (closeTray(), actions.onStatus(task, "Need to Submit"))} tabbable={trayOpen} />
        <TrayButton icon={CalendarDays} label="Due" onClick={() => (closeTray(), actions.onOpen(task, "due"))} tabbable={trayOpen} />
        <TrayButton icon={Trash2} label="Delete" danger onClick={() => (closeTray(), actions.onDelete(task))} tabbable={trayOpen} />
      </motion.div>

      <motion.div
        drag={completing ? false : "x"}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -TRAY - 24, right: done ? 0 : COMMIT + 56 }}
        dragElastic={0.12}
        onDragStart={() => (dragging.current = true)}
        onDrag={() => {
          const v = x.get();
          const next = v >= COMMIT && !done ? "complete" : v <= -TRAY * 0.45 ? "tray" : null;
          if (next !== armed) {
            if (next) haptic();
            setArmed(next);
          }
        }}
        onDragEnd={() => {
          setTimeout(() => (dragging.current = false), 0);
          const v = x.get();
          setArmed(null);
          if (v >= COMMIT && !done) {
            animate(x, 0, spring.ui);
            complete();
          } else if (v <= -TRAY * 0.45) {
            setTrayOpen(true);
            animate(x, -TRAY, spring.ui);
          } else {
            setTrayOpen(false);
            animate(x, 0, spring.ui);
          }
        }}
        className="relative flex min-h-14 touch-pan-y items-start gap-3 rounded-card bg-bg px-3 py-3 hover:bg-gray-100"
        style={{ x, transition: "background-color 150ms var(--ease-out)" }}
      >
        <Checkbox checked={showDone} inProgress={inProgress && !showDone} animateIn={completing} reduced={reduced} onClick={complete} label={task.title} />

        <button
          type="button"
          onClick={() => {
            if (dragging.current) return;
            if (trayOpen) return closeTray();
            actions.onOpen(task);
          }}
          className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label={`${task.title}${due ? `, due ${due.text}` : ""}. Open details`}
        >
          <p className={`line-clamp-2 break-words text-body ${showDone ? "text-gray-900" : "text-gray-1000"}`}>
            <span className="strike" data-on={showDone}>
              {task.title}
            </span>
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-gray-900">
            {course && (
              <span className="flex items-center gap-1.5 text-gray-1000">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                {course.name}
              </span>
            )}
            {due && (
              <span title={due.exact} className={`tabular ${due.overdue && !showDone ? "font-medium text-red" : ""}`}>
                {due.text}
              </span>
            )}
            {Icon && (
              <span className="flex items-center gap-1" title={task.type ?? undefined}>
                <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{task.type}</span>
              </span>
            )}
            {mins && <span className="font-mono text-label tabular">{mins}</span>}
            {inProgress && <span>{task.status}</span>}
            {task.priority === "High" && !showDone && <span className="text-gray-1000">High</span>}
            {task.pending && <span className="sr-only">Saving</span>}
          </span>
        </button>
        {task.calendarEvent && (
          <a
            href={task.calendarEvent}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="pressable mt-0.5 flex h-7 shrink-0 items-center gap-1 rounded-full border border-hairline px-2 text-label text-gray-900 hover:text-gray-1000"
            title={task.scheduledFor ? `Scheduled ${dueLabel(task.scheduledFor, now)?.exact ?? ""}` : "On your calendar"}
          >
            <CalendarCheck size={12} strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">on calendar</span>
            <span className="sr-only sm:hidden">On calendar</span>
          </a>
        )}
      </motion.div>
    </div>
  );
}

function TrayButton({ icon: Icon, label, onClick, danger, tabbable }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean; tabbable: boolean }) {
  return (
    <button
      onClick={onClick}
      tabIndex={tabbable ? 0 : -1}
      className={`pressable flex h-full flex-col items-center justify-center gap-1 text-label ${danger ? "bg-gray-300 text-red" : "bg-gray-200 text-gray-1000"}`}
      style={{ width: ACTION_W }}
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}

function Checkbox({
  checked,
  inProgress,
  animateIn,
  reduced,
  onClick,
  label,
}: {
  checked: boolean;
  inProgress: boolean;
  animateIn: boolean;
  reduced: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${checked ? "Reopen" : "Complete"} ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // 44px hit area around a 20px circle.
      className="pressable relative -m-3 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className={`relative flex size-5 items-center justify-center rounded-full border-[1.5px] ${checked ? "border-accent" : inProgress ? "border-accent" : "border-gray-500"}`}>
        {/* Circular wipe: a filled disc scaling from the centre. */}
        <motion.span
          className="absolute -inset-[1.5px] rounded-full bg-accent"
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={animateIn && !reduced ? { ...spring.ui, stiffness: 500 } : { duration: 0.15 }}
        />
        {inProgress && <span className="size-2 rounded-full bg-accent opacity-60" />}
        <svg width="12" height="12" viewBox="0 0 12 12" className="relative text-on-accent" aria-hidden="true">
          <motion.path
            d="M2.5 6.2 5 8.5l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={animateIn && !reduced ? { pathLength: { delay: 0.1, duration: 0.25, ease: easeOut }, opacity: { duration: 0.05, delay: 0.1 } } : { duration: 0 }}
          />
        </svg>
      </span>
      {animateIn && !reduced && <Burst />}
    </button>
  );
}

/** 7 accent particles flying out of the checkbox. */
function Burst() {
  const parts = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = 13 + (i % 3) * 3.5;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: i % 2 ? 3 : 4 };
  });
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full bg-accent"
          style={{ width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2 }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.05 }}
        />
      ))}
    </span>
  );
}
