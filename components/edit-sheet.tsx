"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, ExternalLink, Trash2 } from "lucide-react";
import { Sheet } from "./sheet";
import { TYPE_ICON } from "./task-row";
import { accentStyle } from "@/lib/colors";
import { dueLabel } from "@/lib/format";
import { dateKey, fromZoned, zonedParts, startOfDay } from "@/lib/time";
import { timezone } from "@/config/bells";
import { PRIORITIES, TASK_TYPES, type Course, type NotionDate, type Priority, type Status, type TaskPatch, type TaskType } from "@/lib/types";
import type { ClientTask } from "@/lib/client/task-store";

const STATUSES: Status[] = ["Not started", "In progress", "Need to Submit", "Submitted"];

type Draft = {
  title: string;
  date: string; // YYYY-MM-DD or ""
  time: string; // HH:MM or ""
  type: TaskType | null;
  minutes: string;
  priority: Priority | null;
  status: string;
};

function toDraft(t: ClientTask): Draft {
  let date = "";
  let time = "";
  if (t.due) {
    if (t.due.start.length === 10) date = t.due.start;
    else {
      const d = new Date(t.due.start);
      date = dateKey(d, timezone);
      const z = zonedParts(d, timezone);
      time = `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
    }
  }
  return { title: t.title, date, time, type: t.type, minutes: t.minutes?.toString() ?? "", priority: t.priority, status: t.status };
}

function draftDue(d: Draft): NotionDate {
  if (!d.date) return null;
  if (!d.time) return { start: d.date, end: null };
  const [y, m, day] = d.date.split("-").map(Number);
  const [h, min] = d.time.split(":").map(Number);
  return { start: fromZoned(y, m, day, h, min, timezone).toISOString(), end: null };
}

export function diffPatch(task: ClientTask, d: Draft): TaskPatch {
  const before = toDraft(task);
  const patch: TaskPatch = {};
  const title = d.title.trim();
  if (title && title !== task.title) patch.title = title;
  if (d.date !== before.date || d.time !== before.time) patch.due = draftDue(d);
  if (d.type !== before.type) patch.type = d.type;
  if (d.minutes !== before.minutes) patch.minutes = d.minutes ? Math.max(0, Math.round(Number(d.minutes))) : null;
  if (d.priority !== before.priority) patch.priority = d.priority;
  if (d.status !== before.status) patch.status = d.status as Status;
  return patch;
}

export function EditSheet({
  task,
  course,
  focus,
  now,
  onClose,
  onSave,
  onDelete,
}: {
  task: ClientTask | null;
  course: Course | null;
  focus?: "due";
  now: Date;
  onClose: () => void;
  onSave: (task: ClientTask, patch: TaskPatch) => void;
  onDelete: (task: ClientTask) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(task ? toDraft(task) : null);
  const [last, setLast] = useState<ClientTask | null>(task);
  const [showTime, setShowTime] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Reset the draft whenever a different task opens.
  if (task && task.key !== last?.key) {
    setLast(task);
    setDraft(toDraft(task));
    setShowTime(false);
  }

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft?.title, task]);

  const close = () => {
    if (last && draft) {
      const patch = diffPatch(last, draft);
      if (Object.keys(patch).length) onSave(last, patch);
    }
    onClose();
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const today = startOfDay(now, timezone);
  const quick = [
    { label: "Today", date: dateKey(today, timezone) },
    { label: "Tomorrow", date: dateKey(new Date(today.getTime() + 86_400_000 + 3_600_000), timezone) },
    { label: "Next week", date: dateKey(new Date(today.getTime() + 7 * 86_400_000 + 3_600_000), timezone) },
  ];

  const t = last;
  return (
    <Sheet open={!!task} onClose={close} label="Edit task" style={accentStyle(course?.color)} initialFocus={focus === "due" ? "#due-date" : undefined}>
      {t && draft && (
        <div className="flex flex-col gap-6 pb-2 pt-2">
          <div className="flex items-center gap-2 text-small text-gray-900">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
            {course?.name ?? "No class"}
            {t.source === "Canvas" && <span className="rounded-full border border-hairline px-2 py-px text-label">Canvas</span>}
            <button onClick={close} className="pressable ml-auto h-9 rounded-full bg-gray-1000 px-4 text-body font-medium text-bg">
              Done
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Title</span>
            <textarea
              ref={titleRef}
              rows={1}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="w-full resize-none overflow-hidden bg-transparent text-heading font-semibold tracking-[-0.01em] text-gray-1000 outline-none"
            />
          </label>

          <Field label="Status">
            <Segmented
              options={STATUSES.map((s) => ({ value: s, label: s === "Need to Submit" ? "To submit" : s }))}
              value={STATUSES.includes(draft.status as Status) ? draft.status : null}
              onChange={(v) => set("status", v)}
            />
          </Field>

          <Field label="Due">
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <Chip key={q.label} on={draft.date === q.date && !draft.time} onClick={() => setDraft({ ...draft, date: q.date, time: "" })}>
                  {q.label}
                </Chip>
              ))}
              <Chip on={!draft.date} onClick={() => setDraft({ ...draft, date: "", time: "" })}>
                None
              </Chip>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                id="due-date"
                type="date"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-card border border-hairline bg-gray-100 px-3 font-mono text-body tabular text-gray-1000 outline-none focus-visible:border-accent"
                aria-label="Due date"
              />
              {draft.time || showTime ? (
                <input
                  type="time"
                  value={draft.time}
                  disabled={!draft.date}
                  autoFocus={showTime && !draft.time}
                  onChange={(e) => set("time", e.target.value)}
                  className="h-11 w-32 rounded-card border border-hairline bg-gray-100 px-3 font-mono text-body tabular text-gray-1000 outline-none focus-visible:border-accent disabled:opacity-40"
                  aria-label="Due time"
                />
              ) : (
                <button
                  type="button"
                  disabled={!draft.date}
                  onClick={() => setShowTime(true)}
                  className="pressable h-11 shrink-0 rounded-card border border-dashed border-hairline-strong px-3 text-small text-gray-900 hover:text-gray-1000 disabled:opacity-40"
                >
                  + Time
                </button>
              )}
            </div>
            {draft.date && <p className="mt-1.5 text-small text-gray-900">{dueLabel(draftDue(draft), now)?.exact}</p>}
          </Field>

          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((ty) => {
                const Icon = TYPE_ICON[ty];
                return (
                  <Chip key={ty} on={draft.type === ty} onClick={() => set("type", draft.type === ty ? null : ty)}>
                    <Icon size={14} strokeWidth={1.5} aria-hidden="true" /> {ty}
                  </Chip>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Est. minutes">
              <div className="flex gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={draft.minutes}
                  onChange={(e) => set("minutes", e.target.value)}
                  placeholder="—"
                  className="h-11 w-20 rounded-card border border-hairline bg-gray-100 px-3 font-mono text-body tabular text-gray-1000 outline-none placeholder:text-gray-900 focus-visible:border-accent"
                  aria-label="Estimated minutes"
                />
                {[15, 30, 60].map((m) => (
                  <Chip key={m} on={draft.minutes === String(m)} onClick={() => set("minutes", String(m))}>
                    <span className="font-mono tabular">{m}</span>
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Priority">
              <Segmented options={PRIORITIES.map((p) => ({ value: p, label: p }))} value={draft.priority} onChange={(v) => set("priority", v as Priority)} />
            </Field>
          </div>

          {(t.scheduledFor || t.calendarEvent) && (
            <div className="flex items-center gap-3 rounded-card border border-hairline px-3 py-2.5 text-small text-gray-900">
              <CalendarCheck size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="flex-1">
                {t.scheduledFor ? <>Scheduled {dueLabel(t.scheduledFor, now)?.exact}</> : "On your calendar"}
                <span className="block text-label">Set by your scheduler. Dial doesn&rsquo;t change it.</span>
              </span>
              {t.calendarEvent && (
                <a href={t.calendarEvent} target="_blank" rel="noreferrer" className="pressable flex h-9 items-center rounded-full px-3 text-gray-1000 hover:bg-gray-100">
                  Open
                </a>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-hairline pt-4">
            {t.url && t.url !== "#" ? (
              <a href={t.url} target="_blank" rel="noreferrer" className="pressable -ml-3 flex h-11 items-center gap-2 rounded-full px-3 text-body text-gray-1000 hover:bg-gray-100">
                <ExternalLink size={16} strokeWidth={1.5} /> Open in Notion
              </a>
            ) : (
              <span />
            )}
            <button
              onClick={() => {
                onDelete(t);
                onClose();
              }}
              className="pressable -mr-3 flex h-11 items-center gap-2 rounded-full px-3 text-body text-red hover:bg-gray-100"
            >
              <Trash2 size={16} strokeWidth={1.5} /> Delete
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-label uppercase tracking-[0.04em] text-gray-900">{label}</p>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`pressable flex h-9 items-center gap-1.5 rounded-full border px-3 text-small ${
        on ? "border-gray-1000 bg-gray-1000 text-bg" : "border-hairline text-gray-1000 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T | null; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex rounded-full border border-hairline bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`pressable h-9 flex-1 whitespace-nowrap rounded-full px-2 text-small ${value === o.value ? "bg-bg text-gray-1000 shadow-[0_0_0_1px_var(--hairline-strong)]" : "text-gray-900 hover:text-gray-1000"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
