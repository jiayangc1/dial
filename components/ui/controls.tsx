"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Segmented control. Segments are equal width, so the selected pill is a
 * single element sliding by transform: no layout measuring, no jumps.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  const idx = options.findIndex((o) => o.value === value);
  const n = options.length;
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (Math.max(0, idx) + step + n) % n;
    onChange(options[next].value);
    (e.currentTarget.children[next + 1] as HTMLElement | undefined)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="relative flex rounded-full border border-hairline bg-gray-100 p-0.5">
      <span
        aria-hidden="true"
        className="segment-thumb pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full bg-bg shadow-[0_0_0_1px_var(--hairline-strong),0_1px_2px_rgba(0,0,0,0.12)]"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          transform: `translateX(${Math.max(0, idx) * 100}%)`,
          opacity: idx < 0 ? 0 : 1,
        }}
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === Math.max(0, idx) ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`relative h-9 flex-1 truncate whitespace-nowrap rounded-full px-2 text-small transition-colors duration-150 ${
            i === idx ? "font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`pressable flex h-9 items-center gap-1.5 rounded-full border px-3 text-small transition-colors duration-150 ${
        on ? "border-gray-1000 bg-gray-1000 text-bg" : "border-hairline text-gray-1000 hover:border-hairline-strong hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/** Minutes field: − / value / +, typing allowed, digits only. */
export function Stepper({ value, onChange, step = 5, label, unit }: { value: string; onChange: (v: string) => void; step?: number; label: string; unit?: string }) {
  const n = Number(value) || 0;
  const bump = (d: number) => {
    const next = Math.max(0, Math.round((n + d) / step) * step);
    onChange(next ? String(next) : "");
  };
  return (
    <div className="field flex h-11 items-center focus-within:field-active">
      <button type="button" aria-label={`Less (${step})`} onClick={() => bump(-step)} disabled={!n} className="pressable flex h-full w-10 shrink-0 items-center justify-center rounded-l-[inherit] text-gray-900 hover:text-gray-1000 disabled:opacity-30">
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <label className="flex h-full min-w-0 flex-1 items-center justify-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              bump(e.key === "ArrowUp" ? step : -step);
            }
          }}
          inputMode="numeric"
          placeholder="–"
          aria-label={label}
          className="h-full w-10 min-w-0 bg-transparent text-center font-mono text-body tabular text-gray-1000 outline-none placeholder:text-gray-900 focus-visible:outline-none"
        />
        {unit && <span className="pointer-events-none -ml-1 text-small text-gray-900">{unit}</span>}
      </label>
      <button type="button" aria-label={`More (${step})`} onClick={() => bump(step)} className="pressable flex h-full w-10 shrink-0 items-center justify-center rounded-r-[inherit] text-gray-900 hover:text-gray-1000">
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-hairline-strong bg-gray-100 px-1 font-sans text-[11px] font-medium leading-none text-gray-900 ${className}`}>
      {children}
    </kbd>
  );
}
