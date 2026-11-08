"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, CornerDownLeft, Crosshair, LogOut, Plus, Search, CircleCheck, Circle, CircleDot } from "lucide-react";
import { Kbd } from "./ui/controls";
import { isMac } from "@/lib/client/platform";
import { accentStyle } from "@/lib/colors";
import { dueLabel } from "@/lib/format";
import { compareTasks } from "@/lib/tasks";
import { spring, fadeFast } from "@/lib/motion";
import type { ClientTask } from "@/lib/client/task-store";
import type { Course } from "@/lib/types";

type Item = {
  id: string;
  group: "Actions" | "Classes" | "Tasks" | "Upcoming" | "Account";
  label: string;
  /** Character ranges in `label` to highlight. */
  hit?: [number, number] | null;
  sub?: string;
  left: React.ReactNode;
  right?: React.ReactNode;
  run: () => void;
  task?: ClientTask;
};

/**
 * ⌘K: one box to find any task, switch class or run an action. Opens from
 * anywhere (even while typing in the add bar) with ⌘K / Ctrl+K, or with "/".
 */
export function CommandMenu({
  open,
  onClose,
  tasks,
  courses,
  selectedId,
  nowId,
  now,
  onPickTask,
  onCompleteTask,
  onSelectClass,
  onNewTask,
  onJumpNow,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  tasks: ClientTask[];
  courses: Course[];
  selectedId: string | null;
  nowId: string | null;
  now: Date;
  onPickTask: (t: ClientTask) => void;
  onCompleteTask: (t: ClientTask) => void;
  onSelectClass: (id: string) => void;
  onNewTask: (text?: string) => void;
  onJumpNow: () => void;
  onSignOut: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const runAfterClose = useRef<(() => void) | null>(null);

  // Reset each time it opens, and give focus back when it closes.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setActive(0);
    }
  }
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      const run = runAfterClose.current;
      runAfterClose.current = null;
      if (run) requestAnimationFrame(run);
      else restore.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const selected = selectedId ? byId.get(selectedId) : null;
  const nowCourse = nowId ? byId.get(nowId) : null;

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: Item[] = [];
    const icon = (I: typeof Plus) => <I size={16} strokeWidth={1.5} className="text-gray-900" aria-hidden="true" />;
    const dot = (c?: Course | null) => <span className="size-2 rounded-full bg-accent" style={accentStyle(c?.color)} aria-hidden="true" />;

    // Actions
    const actions: Item[] = [
      {
        id: "a-new",
        group: "Actions",
        label: selected ? `New task in ${selected.name}` : "New task",
        left: icon(Plus),
        right: <Kbd>N</Kbd>,
        run: () => onNewTask(),
      },
    ];
    if (nowCourse && nowCourse.id !== selectedId)
      actions.push({ id: "a-now", group: "Actions", label: `Jump to now · ${nowCourse.name}`, left: icon(Crosshair), right: <Kbd>.</Kbd>, run: onJumpNow });
    for (const a of actions) {
      const hit = match(a.label, needle);
      if (!needle || hit) out.push({ ...a, hit: needle ? hit : null });
    }

    // Classes
    for (const c of courses) {
      const hit = match(c.name, needle);
      if (needle && !hit && !c.instructor?.toLowerCase().includes(needle)) continue;
      const isSel = c.id === selectedId;
      out.push({
        id: `c-${c.id}`,
        group: "Classes",
        label: c.name,
        hit: needle ? hit : null,
        sub: c.instructor ?? undefined,
        left: dot(c),
        right:
          c.id === nowId ? (
            <span className="rounded-full border border-hairline-strong px-1.5 py-px text-label text-gray-900">Now</span>
          ) : isSel ? (
            <span className="text-label text-gray-900">Current</span>
          ) : null,
        run: () => onSelectClass(c.id),
      });
    }

    // Tasks: with no query, the next few things due; with one, every match.
    const mine = tasks.filter((t) => t.courseIds.some((id) => byId.has(id)));
    const taskItem = (t: ClientTask, group: Item["group"], hit: [number, number] | null): Item => {
      const c = byId.get(t.courseIds.find((id) => byId.has(id))!);
      const due = dueLabel(t.due, now);
      const done = t.statusGroup === "complete";
      const S = done ? CircleCheck : t.statusGroup === "in_progress" ? CircleDot : Circle;
      return {
        id: `t-${t.key}`,
        group,
        label: t.title,
        hit,
        task: t,
        left: <S size={16} strokeWidth={1.5} className={done ? "text-gray-600" : "text-accent"} style={accentStyle(c?.color)} aria-hidden="true" />,
        right: (
          <span className="flex shrink-0 items-center gap-2 text-small text-gray-900">
            <span className="hidden max-w-[140px] truncate sm:inline">{c?.name}</span>
            {due && <span className={`tabular ${due.overdue && !done ? "text-red" : ""}`}>{due.text}</span>}
          </span>
        ),
        run: () => onPickTask(t),
      };
    };
    if (!needle) {
      mine
        .filter((t) => t.statusGroup !== "complete")
        .sort(compareTasks)
        .slice(0, 6)
        .forEach((t) => out.push(taskItem(t, "Upcoming", null)));
    } else {
      mine
        .map((t) => ({ t, hit: match(t.title, needle), course: byId.get(t.courseIds[0])?.name.toLowerCase().includes(needle) }))
        .filter((r) => r.hit || r.course)
        .sort(
          (a, b) =>
            Number(a.t.statusGroup === "complete") - Number(b.t.statusGroup === "complete") ||
            (a.hit?.[0] === 0 ? 0 : 1) - (b.hit?.[0] === 0 ? 0 : 1) ||
            compareTasks(a.t, b.t),
        )
        .slice(0, 24)
        .forEach((r) => out.push(taskItem(r.t, "Tasks", r.hit)));
    }

    if (needle) {
      out.push({
        id: "a-add",
        group: "Actions",
        label: `Add “${q.trim()}”${selected ? ` to ${selected.name}` : ""}`,
        left: icon(Plus),
        run: () => onNewTask(q.trim()),
      });
    }
    if (!needle || match("sign out", needle)) out.push({ id: "a-out", group: "Account", label: "Sign out", hit: needle ? match("Sign out", needle) : null, left: icon(LogOut), run: onSignOut });

    // Group order, keeping each group's internal order.
    const order: Item["group"][] = needle ? ["Tasks", "Classes", "Actions", "Account"] : ["Actions", "Upcoming", "Classes", "Account"];
    return order.flatMap((g) => out.filter((i) => i.group === g));
  }, [q, tasks, courses, byId, selected, selectedId, nowCourse, nowId, now, onNewTask, onJumpNow, onSelectClass, onPickTask, onSignOut]);

  const activeItem = items[Math.min(active, items.length - 1)];

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    runAfterClose.current = item.run;
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = items.length;
    const down = e.key === "ArrowDown" || (e.ctrlKey && e.key === "n");
    const up = e.key === "ArrowUp" || (e.ctrlKey && e.key === "p");
    if (down || up) {
      e.preventDefault();
      if (n) setActive((a) => (Math.min(a, n - 1) + (down ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && activeItem?.task && activeItem.task.statusGroup !== "complete") {
        const t = activeItem.task;
        runAfterClose.current = () => onCompleteTask(t);
        onClose();
      } else run(activeItem);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (q) {
        setQ("");
        setActive(0);
      } else onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  if (typeof document === "undefined") return null;
  let lastGroup: string | null = null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-2 pt-[calc(var(--safe-top)+8px)] md:px-4 md:pt-[14vh]" onKeyDown={onKey}>
          <m.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeFast}
            onClick={onClose}
            aria-hidden="true"
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring.ui}
            style={{ transformOrigin: "50% 0%" }}
            className="menu-surface relative flex max-h-[min(560px,calc(100dvh-var(--safe-top)-16px))] w-full max-w-[640px] flex-col overflow-hidden rounded-sheet md:max-h-[min(560px,72vh)]"
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4">
              <Search size={18} strokeWidth={1.5} className="shrink-0 text-gray-900" aria-hidden="true" />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search tasks, classes and actions…"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
                aria-activedescendant={activeItem ? `cmdk-${activeItem.id}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="h-full min-w-0 flex-1 bg-transparent text-lead text-gray-1000 outline-none placeholder:text-gray-900 focus-visible:outline-none md:text-[15px]"
              />
              <button type="button" onClick={onClose} className="pressable -mr-2 h-9 shrink-0 rounded-full px-2 text-body text-gray-900 hover:text-gray-1000 md:hidden">
                Cancel
              </button>
              <button type="button" onClick={onClose} className="pressable hidden shrink-0 md:block" aria-label="Close">
                <Kbd>Esc</Kbd>
              </button>
            </div>

            <div ref={list} id="cmdk-list" role="listbox" aria-label="Results" className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {items.length === 0 && <p className="px-3 py-10 text-center text-body text-gray-900">No results.</p>}
              {items.map((it, i) => {
                const head = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                const on = i === active;
                return (
                  <div key={it.id}>
                    {head && <p className={`px-3 pb-1.5 text-label font-medium text-gray-900 ${i ? "pt-3" : "pt-1.5"}`}>{head}</p>}
                    <div
                      id={`cmdk-${it.id}`}
                      data-idx={i}
                      role="option"
                      aria-selected={on}
                      onPointerMove={() => active !== i && setActive(i)}
                      onClick={() => run(it)}
                      className={`relative flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-3 py-2 transition-colors duration-100 ${on ? "bg-gray-100" : ""}`}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">{it.left}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-body ${it.task?.statusGroup === "complete" ? "text-gray-900 line-through" : "text-gray-1000"}`}>
                          <Highlight text={it.label} hit={it.hit} />
                        </span>
                        {it.sub && <span className="block truncate text-small text-gray-900">{it.sub}</span>}
                      </span>
                      {it.right}
                      <span className={`flex w-4 shrink-0 justify-center text-gray-900 transition-opacity duration-100 ${on ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
                        {it.group === "Classes" ? <ArrowRight size={14} strokeWidth={1.5} /> : <CornerDownLeft size={14} strokeWidth={1.5} />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden h-10 shrink-0 items-center gap-4 border-t border-hairline px-4 text-label text-gray-900 md:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> {activeItem?.task ? "open" : "select"}
              </span>
              {activeItem?.task && activeItem.task.statusGroup !== "complete" && (
                <span className="flex items-center gap-1.5">
                  <Kbd>{isMac() ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>↵</Kbd> complete
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                <Kbd>Esc</Kbd> close
              </span>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Word-start match first, then anywhere. Returns the matched range. */
function match(text: string, needle: string): [number, number] | null {
  if (!needle) return null;
  const t = text.toLowerCase();
  const word = new RegExp(`(^|[\\s(/·-])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(t);
  if (word) {
    const s = word.index + word[1].length;
    return [s, s + needle.length];
  }
  const i = t.indexOf(needle);
  return i >= 0 ? [i, i + needle.length] : null;
}

function Highlight({ text, hit }: { text: string; hit?: [number, number] | null }) {
  if (!hit) return <>{text}</>;
  return (
    <>
      {text.slice(0, hit[0])}
      <mark className="match">{text.slice(hit[0], hit[1])}</mark>
      {text.slice(hit[1])}
    </>
  );
}
