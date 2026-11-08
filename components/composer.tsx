"use client";

import { onWarm } from "@/lib/client/warm";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowUp, Check, ChevronDown, X } from "lucide-react";
import type { Parsed, TokenKind, parseQuickAdd as ParseFn } from "@/lib/parse";
import { dueLabel, minutesLabel } from "@/lib/format";
import { timezone } from "@/config/bells";
import { spring, fade } from "@/lib/motion";
import { accentStyle } from "@/lib/colors";
import type { Course, NewTask } from "@/lib/types";

const EXAMPLES = ["ws 2.4 fri 30m", "unit 3 quiz tue", "read ch 5 tmrw 45m", "lab report @chem nov 20", "study for test thu 1h !"];

export type ComposerHandle = { focus: () => void; openPicker: () => void };

type Props = {
  courses: Course[];
  selected: Course | null;
  /** The class happening now (or next up). Marked in the dropdown. */
  nowId: string | null;
  /** "Now" in class, "Next" during a passing period. */
  nowLabel: "Now" | "Next";
  openCounts: Map<string, number>;
  onSelect: (courseId: string) => void;
  now: Date;
  onAdd: (task: NewTask) => void;
};

/**
 * The entry box: a class dropdown (pre-filled with the class you're in right
 * now) on top, the quick-add input underneath, parsed chips in between.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ courses, selected, nowId, nowLabel, openCounts, onSelect, now, onAdd }, ref) {
  const [value, setValue] = useState("");
  const [ignore, setIgnore] = useState<Set<TokenKind>>(new Set());
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    openPicker: () => setPickerOpen(true),
  }));

  useEffect(() => {
    if (value || focused) return;
    const id = setInterval(() => setExample((e) => (e + 1) % EXAMPLES.length), 3500);
    return () => clearInterval(id);
  }, [value, focused]);

  // chrono-node is the heaviest dependency; load it on first focus, not on boot.
  const [parse, setParse] = useState<typeof ParseFn | null>(null);
  const loadParser = () => {
    if (!parse) void import("@/lib/parse").then((m) => setParse(() => m.parseQuickAdd));
  };
  // Warm it up on first touch, or once the page is quiet, so it's cached before you go offline.
  useEffect(() => onWarm(() => void import("@/lib/parse").then((m) => setParse(() => m.parseQuickAdd))), []);
  const day = now.toDateString();
  const parsed: Parsed | null = useMemo(
    () => (value.trim() && parse ? parse(value, { now, timezone, courses, ignore }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, courses, ignore, day, parse],
  );
  const target = (parsed?.courseId && courses.find((c) => c.id === parsed.courseId)) || selected;

  const submit = () => {
    if (!target) return;
    // Parser not loaded (e.g. offline before it was cached): add the raw text.
    if (!parse) {
      const title = value.trim();
      if (!title) return;
      onAdd({ title, courseId: target.id, due: null, minutes: null, type: null, priority: "Medium" });
      setValue("");
      return;
    }
    if (!parsed?.title) return;
    onAdd({ title: parsed.title, courseId: target.id, due: parsed.due, minutes: parsed.minutes, type: parsed.type, priority: parsed.priority ?? "Medium" });
    setValue("");
    setIgnore(new Set());
  };

  const canSubmit = parse ? !!parsed?.title : !!value.trim();
  const chips = parsed?.tokens.map((t) => ({ kind: t.kind, label: chipLabel(t.kind, parsed, now, courses) })) ?? [];

  return (
    <div className="relative" style={accentStyle(target?.color)}>
      <div
        className={`surface relative rounded-sheet transition-[box-shadow] duration-150 ${focused ? "shadow-[0_0_0_2px_var(--accent)]" : ""}`}
      >
        <ClassPicker
          courses={courses}
          selected={selected}
          nowId={nowId}
          nowLabel={nowLabel}
          openCounts={openCounts}
          open={pickerOpen}
          setOpen={setPickerOpen}
          onSelect={(id) => {
            onSelect(id);
            requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
          }}
        />

        <AnimatePresence initial={false}>
          {chips.length > 0 && (
            <m.div
              key="chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="flex flex-wrap gap-1.5 px-3 pt-3"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map((c) => (
                  <m.span
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
                  </m.span>
                ))}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative flex h-[52px] items-center gap-2 pl-4 pr-1.5"
        >
          <div className="relative min-w-0 flex-1">
            <input
              ref={input}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (!e.target.value) setIgnore(new Set());
              }}
              onFocus={() => {
                setFocused(true);
                loadParser();
              }}
              onPointerEnter={loadParser}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setValue("");
                  setIgnore(new Set());
                  input.current?.blur();
                }
              }}
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={target ? `New task for ${target.name}` : "New task"}
              className="h-11 w-full bg-transparent text-lead text-gray-1000 outline-none focus-visible:outline-none md:text-body"
            />
            {!value && (
              <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-lead text-gray-900 md:text-body" aria-hidden="true">
                <span className="shrink-0">Add a task…&nbsp;</span>
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={example}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={fade}
                    className="truncate"
                  >
                    e.g. &lsquo;{EXAMPLES[example]}&rsquo;
                  </m.span>
                </AnimatePresence>
              </span>
            )}
          </div>
          <m.button
            type="submit"
            animate={{ opacity: canSubmit ? 1 : 0.35, scale: canSubmit ? 1 : 0.9 }}
            transition={spring.ui}
            disabled={!canSubmit}
            aria-label="Add task"
            onMouseDown={(e) => e.preventDefault()}
            className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-1000 text-bg"
          >
            <ArrowUp size={18} strokeWidth={1.75} />
          </m.button>
        </form>
      </div>
    </div>
  );
});

function ClassPicker({
  courses,
  selected,
  nowId,
  nowLabel,
  openCounts,
  open,
  setOpen,
  onSelect,
}: {
  courses: Course[];
  selected: Course | null;
  nowId: string | null;
  nowLabel: "Now" | "Next";
  openCounts: Map<string, number>;
  open: boolean;
  setOpen: (o: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const selectedIdx = Math.max(0, courses.findIndex((c) => c.id === selected?.id));
  const [active, setActive] = useState(selectedIdx);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(selectedIdx);
    requestAnimationFrame(() => list.current?.focus({ preventScroll: true }));
  }, [open, selectedIdx]);

  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (i: number) => {
    const c = courses[i];
    setOpen(false);
    if (c) onSelect(c.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = courses.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead: "c" → Chemistry, "co" → Computer Science.
      const t = performance.now();
      typed.current = { text: (t - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: t };
      const i = courses.findIndex((c) => c.name.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  const isNow = selected?.id === nowId;
  const nowCourse = nowId ? courses.find((c) => c.id === nowId) : null;

  return (
    <div className="relative border-b border-hairline" style={accentStyle(selected?.color)}>
      <div className="flex h-12 items-center gap-1 px-1.5">
        <button
          ref={button}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Class: ${selected?.name ?? "none"}. Change class`}
          onClick={() => setOpen(!open)}
          className="pressable flex h-10 min-w-0 items-center gap-2 rounded-card px-2.5 hover:bg-gray-100"
        >
          <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span className="truncate text-body font-medium text-gray-1000">{selected?.name ?? "Choose a class"}</span>
          <m.span animate={{ rotate: open ? 180 : 0 }} transition={spring.ui} className="flex shrink-0 text-gray-900">
            <ChevronDown size={16} strokeWidth={1.5} />
          </m.span>
        </button>
        {isNow ? (
          <span className="shrink-0 rounded-full border border-hairline-strong px-2 py-px text-label text-gray-900">{nowLabel}</span>
        ) : (
          nowCourse && (
            <button
              type="button"
              onClick={() => onSelect(nowCourse.id)}
              className="pressable ml-auto flex h-9 min-w-0 shrink items-center gap-1.5 rounded-full px-2.5 text-small text-gray-900 hover:bg-gray-100 hover:text-gray-1000"
              style={accentStyle(nowCourse.color)}
              aria-label={`Back to ${nowCourse.name}, the class happening now (.)`}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span className="truncate">
                {nowLabel}: {nowCourse.name}
              </span>
            </button>
          )
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <m.ul
              ref={list}
              role="listbox"
              tabIndex={-1}
              aria-label="Classes"
              aria-activedescendant={`class-opt-${active}`}
              onKeyDown={onKeyDown}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
              transition={spring.ui}
              style={{ transformOrigin: "top left" }}
              className="absolute inset-x-1.5 top-[calc(100%-4px)] z-40 bg-[color-mix(in_srgb,var(--bg)_96%,transparent)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl max-h-[min(380px,60dvh)] overflow-y-auto rounded-sheet border border-hairline-strong p-1 outline-none"
            >
              {courses.map((c, i) => {
                const count = openCounts.get(c.id) ?? 0;
                const sel = c.id === selected?.id;
                return (
                  <li
                    key={c.id}
                    id={`class-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={sel}
                    onClick={() => choose(i)}
                    onPointerMove={() => setActive(i)}
                    style={accentStyle(c.color)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-3 py-2 ${i === active ? "bg-gray-100" : ""}`}
                  >
                    <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-gray-1000">{c.name}</span>
                      {c.instructor && <span className="block truncate text-small text-gray-900">{c.instructor}</span>}
                    </span>
                    {c.id === nowId && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-label font-medium text-on-accent">{nowLabel}</span>}
                    <span className="w-6 shrink-0 text-right font-mono text-small tabular text-gray-900" aria-label={`${count} open`}>
                      {count || "–"}
                    </span>
                    <span className="flex w-4 shrink-0 justify-center text-gray-1000">{sel && <Check size={16} strokeWidth={1.75} />}</span>
                  </li>
                );
              })}
            </m.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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
