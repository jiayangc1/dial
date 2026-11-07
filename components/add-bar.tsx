"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Plus, X } from "lucide-react";
import { parseQuickAdd, type Parsed, type TokenKind } from "@/lib/parse";
import { dueLabel, minutesLabel } from "@/lib/format";
import { timezone } from "@/config/bells";
import { spring, fade } from "@/lib/motion";
import { accentStyle } from "@/lib/colors";
import type { Course, NewTask } from "@/lib/types";

const EXAMPLES = ["ws 2.4 fri 30m", "unit 3 quiz tue", "read ch 5 tmrw 45m", "lab report @chem nov 20", "study for test thu 1h !"];

export type AddBarHandle = { focus: () => void };

type Props = {
  course: Course | null;
  courses: Course[];
  now: Date;
  /** Phone: a floating "+" that expands into the bar. Desktop: always-open bar. */
  floating: boolean;
  onAdd: (task: NewTask) => void;
};

export const AddBar = forwardRef<AddBarHandle, Props>(function AddBar({ course, courses, now, floating, onAdd }, ref) {
  const [value, setValue] = useState("");
  const [ignore, setIgnore] = useState<Set<TokenKind>>(new Set());
  const [expanded, setExpanded] = useState(!floating);
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setExpanded(true);
      requestAnimationFrame(() => input.current?.focus());
    },
  }));

   
  useEffect(() => setExpanded(!floating), [floating]);

  useEffect(() => {
    if (value || focused) return;
    const id = setInterval(() => setExample((e) => (e + 1) % EXAMPLES.length), 3500);
    return () => clearInterval(id);
  }, [value, focused]);

  const parsed: Parsed | null = useMemo(
    () => (value.trim() ? parseQuickAdd(value, { now, timezone, courses, ignore }) : null),
    // `now` changes every second; the parse only needs the day, so key on the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, courses, ignore, now.toDateString()],
  );
  const target = (parsed?.courseId && courses.find((c) => c.id === parsed.courseId)) || course;

  const submit = () => {
    if (!parsed || !parsed.title || !target) return;
    onAdd({
      title: parsed.title,
      courseId: target.id,
      due: parsed.due,
      minutes: parsed.minutes,
      type: parsed.type,
      priority: parsed.priority ?? "Medium",
    });
    setValue("");
    setIgnore(new Set());
  };

  const collapse = () => {
    if (floating && !value) setExpanded(false);
  };

  const chips = parsed?.tokens.map((t) => ({ kind: t.kind, label: chipLabel(t.kind, parsed, now, courses) })) ?? [];

  if (floating && !expanded) {
    return (
      <motion.button
        layoutId="addbar"
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
        aria-label={course ? `Add a task to ${course.name} (n)` : "Add a task (n)"}
        className="pressable fixed bottom-[calc(var(--safe-bottom)+20px)] right-4 z-30 flex size-14 items-center justify-center bg-gray-1000 text-bg"
        style={{ borderRadius: 28 }}
        transition={spring.ui}
      >
        <motion.span layout="position">
          <Plus size={24} strokeWidth={1.75} />
        </motion.span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layoutId={floating ? "addbar" : undefined}
      transition={spring.ui}
      className={
        floating
          ? "glass fixed inset-x-3 bottom-[calc(var(--safe-bottom)+12px)] z-30 border border-hairline-strong"
          : "glass relative border border-hairline-strong"
      }
      style={{ borderRadius: 12, ...(target ? accentStyle(target.color) : {}) }}
    >
      <div className={`rounded-sheet transition-shadow duration-150 ${focused ? "shadow-[0_0_0_2px_var(--accent)]" : ""}`}>
        <AnimatePresence initial={false}>
          {chips.length > 0 && (
            <motion.div
              key="chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="flex flex-wrap gap-1.5 px-3 pt-3"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map((c) => (
                  <motion.span
                    key={c.kind}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={spring.ui}
                    className="flex h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-small font-medium text-accent"
                    style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
                  >
                    {c.label}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setIgnore((s) => new Set(s).add(c.kind))}
                      aria-label={`Remove ${c.label}`}
                      className="pressable flex size-5 items-center justify-center rounded-full hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative flex h-[52px] items-center gap-2 pl-4 pr-1.5"
        >
          <Plus size={16} strokeWidth={1.5} className="shrink-0 text-gray-900" aria-hidden="true" />
          <div className="relative min-w-0 flex-1">
            <input
              ref={input}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (!e.target.value) setIgnore(new Set());
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                collapse();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setValue("");
                  setIgnore(new Set());
                  input.current?.blur();
                  if (floating) setExpanded(false);
                }
              }}
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={target ? `Add a task to ${target.name}` : "Add a task"}
              className="h-11 w-full bg-transparent text-lead text-gray-1000 outline-none md:text-body"
            />
            {!value && (
              <span className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden whitespace-nowrap text-lead text-gray-900 md:text-body" aria-hidden="true">
                <span className="shrink-0">Add to {target?.name ?? "…"}…&nbsp;</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={example}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 0.7, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={fade}
                    className="truncate"
                  >
                    e.g. &lsquo;{EXAMPLES[example]}&rsquo;
                  </motion.span>
                </AnimatePresence>
              </span>
            )}
          </div>
          <AnimatePresence>
            {parsed?.title && (
              <motion.button
                type="submit"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={spring.ui}
                aria-label="Add task"
                onMouseDown={(e) => e.preventDefault()}
                className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-1000 text-bg"
              >
                <ArrowUp size={18} strokeWidth={1.75} />
              </motion.button>
            )}
          </AnimatePresence>
        </form>
      </div>
    </motion.div>
  );
});

function chipLabel(kind: TokenKind, p: Parsed, now: Date, courses: Course[]) {
  switch (kind) {
    case "date":
      return dueLabel(p.due, now)?.text ?? "Date";
    case "minutes":
      return minutesLabel(p.minutes) ?? "";
    case "type":
      return p.type ?? "";
    case "priority":
      return `${p.priority} priority`;
    case "course":
      return `→ ${courses.find((c) => c.id === p.courseId)?.name ?? ""}`;
  }
}
