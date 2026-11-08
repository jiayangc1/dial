"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "./popover";
import { easeOut } from "@/lib/motion";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Calendar dates are plain "YYYY-MM-DD" keys. All arithmetic runs in UTC so
// a date never drifts across a DST change or the viewer's own timezone.
const toKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
};
const addDays = (k: string, n: number) => {
  const { y, m, d } = parse(k);
  const t = new Date(Date.UTC(y, m, d + n));
  return toKey(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const weekday = (k: string) => {
  const { y, m, d } = parse(k);
  return new Date(Date.UTC(y, m, d)).getUTCDay();
};

/** "Sat, Nov 7" (adds the year when it isn't this year). */
export function shortDate(k: string, todayKey: string) {
  const { y, m, d } = parse(k);
  const base = `${DAYS[weekday(k)]}, ${MONTHS[m].slice(0, 3)} ${d}`;
  return y === parse(todayKey).y ? base : `${base}, ${y}`;
}

export function DatePicker({ value, onChange, todayKey, id }: { value: string; onChange: (v: string) => void; todayKey: string; id?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Due date, ${shortDate(value, todayKey)}. Change` : "Pick a due date"}
        onClick={() => setOpen((o) => !o)}
        className={`field pressable flex h-11 min-w-0 flex-1 items-center gap-2.5 px-3 text-left text-body ${open ? "field-active" : ""}`}
      >
        <CalendarDays size={16} strokeWidth={1.5} className="shrink-0 text-gray-900" aria-hidden="true" />
        <span className={`truncate ${value ? "text-gray-1000" : "text-gray-900"}`}>{value ? shortDate(value, todayKey) : "Pick a date"}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={trigger} label="Choose a due date" width={296}>
        <Calendar
          value={value}
          todayKey={todayKey}
          onPick={(k) => {
            onChange(k);
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}
          onClear={
            value
              ? () => {
                  onChange("");
                  setOpen(false);
                  trigger.current?.focus({ preventScroll: true });
                }
              : undefined
          }
        />
      </Popover>
    </>
  );
}

function Calendar({ value, todayKey, onPick, onClear }: { value: string; todayKey: string; onPick: (k: string) => void; onClear?: () => void }) {
  const start = parse(value || todayKey);
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [dir, setDir] = useState(0);
  const [focus, setFocus] = useState(value || todayKey);
  const grid = useRef<HTMLDivElement>(null);

  // Roving focus follows the keyboard. Focus now (so a fast arrow-then-Enter
  // lands on the right day) and again next frame, because on first open the
  // popover is still hidden while it measures itself.
  useLayoutEffect(() => {
    const go = () => grid.current?.querySelector<HTMLElement>(`[data-key="${focus}"]`)?.focus({ preventScroll: true });
    go();
    const id = requestAnimationFrame(go);
    return () => cancelAnimationFrame(id);
  }, [focus, view]);

  const shift = (n: number) => {
    setDir(n);
    setView((v) => {
      const t = new Date(Date.UTC(v.y, v.m + n, 1));
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
    });
  };

  const moveFocus = (k: string) => {
    const p = parse(k);
    if (p.y !== view.y || p.m !== view.m) {
      setDir(p.y * 12 + p.m > view.y * 12 + view.m ? 1 : -1);
      setView({ y: p.y, m: p.m });
    }
    setFocus(k);
  };

  const firstOfMonth = toKey(view.y, view.m, 1);
  const gridStart = addDays(firstOfMonth, -weekday(firstOfMonth));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a trailing week that's entirely next month.
  const rows = parse(cells[35]).m !== view.m ? 5 : 6;

  const onKey = (e: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in steps) {
      e.preventDefault();
      moveFocus(addDays(focus, steps[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const p = parse(focus);
      const t = new Date(Date.UTC(p.y, p.m + (e.key === "PageUp" ? -1 : 1), 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
      moveFocus(toKey(t.getUTCFullYear(), t.getUTCMonth(), Math.min(p.d, last)));
    } else if (e.key === "Enter" || e.key === " ") {
      // From state, not the DOM: a fast arrow-then-Enter must pick the new day.
      e.preventDefault();
      onPick(focus);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(addDays(focus, -weekday(focus)));
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(addDays(focus, 6 - weekday(focus)));
    }
  };

  return (
    <div className="p-3">
      <div className="flex h-9 items-center justify-between pl-2">
        <p className="text-body font-medium text-gray-1000" aria-live="polite">
          {MONTHS[view.m]} <span className="font-mono tabular text-gray-900">{view.y}</span>
        </p>
        <div className="flex">
          <IconButton label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={16} strokeWidth={1.5} />
          </IconButton>
          <IconButton label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-label text-gray-900" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="flex h-7 items-center justify-center">
            {d}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden" style={{ height: rows * 38 }}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <m.div
            key={`${view.y}-${view.m}`}
            ref={grid}
            role="grid"
            aria-label={`${MONTHS[view.m]} ${view.y}`}
            onKeyDown={onKey}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: 16 * d }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: -16 * d }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: easeOut }}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {cells.slice(0, rows * 7).map((k) => {
              const p = parse(k);
              const inMonth = p.m === view.m;
              const sel = k === value;
              const today = k === todayKey;
              return (
                <button
                  key={k}
                  type="button"
                  data-key={k}
                  tabIndex={k === focus ? 0 : -1}
                  aria-pressed={sel}
                  aria-current={today ? "date" : undefined}
                  aria-label={shortDate(k, todayKey)}
                  onClick={() => onPick(k)}
                  className={`pressable relative mx-auto flex size-9 items-center justify-center rounded-full font-mono text-small tabular ${
                    sel ? "bg-gray-1000 font-medium text-bg" : inMonth ? "text-gray-1000 hover:bg-gray-100" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p.d}
                  {today && <span className={`absolute bottom-1 size-1 rounded-full ${sel ? "bg-bg" : "bg-accent"}`} aria-hidden="true" />}
                </button>
              );
            })}
          </m.div>
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
        <button type="button" onClick={() => onPick(todayKey)} className="pressable h-8 rounded-full px-3 text-small text-gray-1000 hover:bg-gray-100">
          Today
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="pressable h-8 rounded-full px-3 text-small text-gray-900 hover:bg-gray-100 hover:text-gray-1000">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="pressable flex size-9 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100 hover:text-gray-1000">
      {children}
    </button>
  );
}
