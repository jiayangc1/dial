"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { Popover } from "./popover";

/** "15:30" → "3:30 PM" */
export function timeLabel(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Every 15 minutes, 6 AM to 11:45 PM: the hours anything is ever due.
const SLOTS = Array.from({ length: 72 }, (_, i) => {
  const mins = 6 * 60 + i * 15;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

export function TimePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // A time set in Notion that isn't on the 15-minute grid still shows up.
  const slots = value && !SLOTS.includes(value) ? [...SLOTS, value].sort() : SLOTS;
  const options = ["", ...slots];
  const selectedIdx = Math.max(0, options.indexOf(value));
  const [active, setActive] = useState(selectedIdx);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    // Land on the selected slot, or 3 PM (after school) when there's none.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(value ? selectedIdx : options.indexOf("15:00"));
    const id = requestAnimationFrame(() => {
      list.current?.focus({ preventScroll: true });
      list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    onChange(options[i]);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(n - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (/^[0-9]$/.test(e.key)) {
      // Type-ahead on the hour: "3" → 3:00 PM, "11" → 11:00 AM.
      const t = e.timeStamp;
      typed.current = { text: (t - typed.current.at < 800 ? typed.current.text : "") + e.key, at: t };
      const hits = options.map((o, j) => [o, j] as const).filter(([o]) => o && timeLabel(o).startsWith(`${typed.current.text}:`));
      // 1–5 almost always means the afternoon.
      const h = Number(typed.current.text);
      const pick = (h >= 1 && h <= 5 ? hits.find(([o]) => Number(o.slice(0, 2)) >= 12) : undefined) ?? hits[0];
      if (pick) setActive(pick[1]);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `Due time, ${timeLabel(value)}. Change` : "Add a due time"}
        onClick={() => setOpen((o) => !o)}
        className={`field pressable flex h-11 w-[128px] shrink-0 items-center gap-2.5 px-3 text-left text-body disabled:opacity-40 ${open ? "field-active" : ""}`}
      >
        <Clock size={16} strokeWidth={1.5} className="shrink-0 text-gray-900" aria-hidden="true" />
        <span className={`truncate ${value ? "font-mono tabular text-gray-1000" : "text-gray-900"}`}>{value ? timeLabel(value) : "Time"}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={trigger} align="end" width={168} label="Choose a due time">
        <div
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label="Due time"
          aria-activedescendant={`time-opt-${active}`}
          onKeyDown={onKey}
          className="scroll-thin max-h-[264px] overflow-y-auto p-1 outline-none"
        >
          {options.map((o, i) => {
            const sel = o === value;
            return (
              <div
                key={o || "none"}
                id={`time-opt-${i}`}
                data-idx={i}
                data-active={i === active}
                role="option"
                aria-selected={sel}
                onClick={() => choose(i)}
                onPointerMove={() => setActive(i)}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-card px-3 text-body ${i === active ? "bg-gray-100" : ""} ${
                  o ? "font-mono tabular text-gray-1000" : "text-gray-900"
                }`}
              >
                {o ? timeLabel(o) : "No time"}
                {sel && <Check size={14} strokeWidth={1.75} className="text-gray-1000" />}
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
