"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { RotateCcw } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { accentFor, accentStyle } from "@/lib/colors";
import { dueLabel } from "@/lib/format";
import { spring } from "@/lib/motion";
import type { Course } from "@/lib/types";
import type { courseStats } from "@/lib/tasks";

export type CardStats = ReturnType<typeof courseStats>;

type Props = {
  courses: Course[];
  stats: Map<string, CardStats>;
  /** Index of the selected (centred) course. */
  selected: number;
  onSelect: (index: number, dir: 1 | -1) => void;
  /** Index of the class happening now (or next up), if any. */
  nowIndex: number | null;
  now: Date;
  compact: boolean;
};

/** Signed shortest distance from b to a on a ring of n. Result in [-n/2, n/2). */
function wrap(d: number, n: number) {
  return ((((d + n / 2) % n) + n) % n) - n / 2;
}

export function Wheel({ courses, stats, selected, onSelect, nowIndex, now, compact }: Props) {
  const n = courses.length;
  const reduced = useReducedMotion() ?? false;
  const pos = useMotionValue(selected);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const emitted = useRef(selected);
  const id = useId();
  const [announce, setAnnounce] = useState("");

  const CARD_W = compact ? 248 : 320;
  const CARD_H = compact ? 168 : 196;
  const SPACING = compact ? 176 : 248;

  // Report the rounded index while spinning, so the list follows the wheel.
  useMotionValueEvent(pos, "change", (p) => {
    const i = ((Math.round(p) % n) + n) % n;
    if (i !== emitted.current) {
      const dir = wrap(i - emitted.current, n) > 0 ? 1 : -1;
      emitted.current = i;
      onSelect(i, dir);
    }
  });

  const settle = (target: number, velocity = 0) => {
    anim.current?.stop();
    if (reduced) {
      pos.set(target);
      return;
    }
    anim.current = animate(pos, target, { ...spring.wheel, velocity });
  };

  // External selection changes (Now button, keyboard, search, period end).
  useEffect(() => {
    const current = pos.get();
    const curIdx = ((Math.round(current) % n) + n) % n;
    if (curIdx === selected) return;
    emitted.current = selected;
    settle(current + wrap(selected - current, n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, n]);

  // ── Drag with momentum ──────────────────────────────────────────────
  const drag = useRef<{ x: number; start: number; samples: Array<{ t: number; p: number }>; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    anim.current?.stop();
    drag.current = { x: e.clientX, start: pos.get(), samples: [{ t: performance.now(), p: pos.get() }], moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    const raw = -dx / SPACING;
    // Rubber band: past one card the wheel resists, so it feels weighty
    // (the fling still carries it further on release).
    const band = Math.abs(raw) <= 1 ? raw : Math.sign(raw) * (1 + (Math.abs(raw) - 1) * 0.55);
    const p = d.start + band;
    pos.set(p);
    const t = performance.now();
    d.samples.push({ t, p });
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const v = b.t > a.t ? ((b.p - a.p) / (b.t - a.t)) * 1000 : 0; // cards per second
    // Project where momentum would carry it, then snap to the nearest card.
    const projected = pos.get() + v * 0.22;
    const target = Math.round(Math.max(pos.get() - 3, Math.min(pos.get() + 3, projected)));
    settle(target, v);
  };

  // ── Mouse wheel / trackpad ─────────────────────────────────────────
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let idle: ReturnType<typeof setTimeout>;
    let lastStep = 0;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      const discrete = e.deltaMode !== 0 || (Math.abs(delta) >= 50 && Number.isInteger(delta));
      if (discrete) {
        const t = performance.now();
        if (t - lastStep < 120) return;
        lastStep = t;
        settle(Math.round(pos.get()) + Math.sign(delta));
        return;
      }
      anim.current?.stop();
      pos.set(pos.get() + delta / (SPACING * 1.4));
      clearTimeout(idle);
      idle = setTimeout(() => settle(Math.round(pos.get())), 110);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SPACING, reduced]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      settle(Math.round(pos.get()) + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      settle(Math.round(pos.get()) - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      settle(pos.get() + wrap(0 - pos.get(), n));
    } else if (e.key === "End") {
      e.preventDefault();
      settle(pos.get() + wrap(n - 1 - pos.get(), n));
    }
  };

  useEffect(() => {
    const c = courses[selected];
    const s = c && stats.get(c.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c) setAnnounce(`${c.name}${s ? `, ${s.open} open` : ""}${selected === nowIndex ? ", now" : ""}`);
  }, [selected, courses, stats, nowIndex]);

  return (
    <div className="relative select-none" style={{ height: CARD_H + 64 }}>
      {/* Accent tint: one layer per class, cross-faded by wheel position. */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-24 -top-24 bottom-0 overflow-hidden">
        {courses.map((c, i) => (
          <TintLayer key={c.id} index={i} n={n} pos={pos} color={c.color} />
        ))}
      </div>

      <div
        ref={ref}
        role="listbox"
        tabIndex={0}
        aria-label="Classes"
        aria-activedescendant={`${id}-opt-${selected}`}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mx-auto h-full cursor-grab touch-pan-y rounded-sheet outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{ perspective: 1000 }}
      >
        {courses.map((c, i) => (
          <Card
            key={c.id}
            id={`${id}-opt-${i}`}
            course={c}
            index={i}
            n={n}
            pos={pos}
            stats={stats.get(c.id)}
            isNow={i === nowIndex}
            selected={i === selected}
            now={now}
            width={CARD_W}
            height={CARD_H}
            spacing={SPACING}
            reduced={reduced}
            onTap={() => {
              if (drag.current?.moved) return;
              settle(pos.get() + wrap(i - pos.get(), n));
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center gap-3">
        <Dots n={n} pos={pos} nowIndex={nowIndex} />
      </div>
      <NowButton visible={nowIndex !== null && nowIndex !== selected} onClick={() => nowIndex !== null && settle(pos.get() + wrap(nowIndex - pos.get(), n))} />

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

function TintLayer({ index, n, pos, color }: { index: number; n: number; pos: MotionValue<number>; color: string | null }) {
  const opacity = useTransform(pos, (p) => Math.max(0, 1 - Math.abs(wrap(index - p, n))));
  const a = accentFor(color);
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        opacity,
        background: `radial-gradient(60% 55% at 50% 45%, color-mix(in srgb, light-dark(${a.light}, ${a.dark}) 7%, transparent), transparent 70%)`,
      }}
    />
  );
}

function Card({
  id,
  course,
  index,
  n,
  pos,
  stats,
  isNow,
  selected,
  now,
  width,
  height,
  spacing,
  reduced,
  onTap,
}: {
  id: string;
  course: Course;
  index: number;
  n: number;
  pos: MotionValue<number>;
  stats: CardStats | undefined;
  isNow: boolean;
  selected: boolean;
  now: Date;
  width: number;
  height: number;
  spacing: number;
  reduced: boolean;
  onTap: () => void;
}) {
  const d = useTransform(pos, (p) => wrap(index - p, n));
  const x = useTransform(d, (v) => {
    const a = Math.abs(v);
    const off = a <= 1 ? a * spacing : spacing + (a - 1) * spacing * 0.55;
    return Math.sign(v) * off;
  });
  const rotateY = useTransform(d, (v) => (reduced ? 0 : Math.max(-1.4, Math.min(1.4, v)) * 35));
  const scale = useTransform(d, (v) => {
    const a = Math.abs(v);
    return 1 - 0.15 * Math.min(a, 1) - 0.07 * Math.max(0, Math.min(a - 1, 1));
  });
  const opacity = useTransform(d, (v) => {
    const a = Math.abs(v);
    return Math.max(0, 1 - 0.3 * Math.min(a, 1) - 0.45 * Math.max(0, a - 1));
  });
  const filter = useTransform(d, (v) => {
    const a = Math.abs(v);
    return reduced || a < 0.35 ? "none" : `blur(${Math.min(3, (a - 0.35) * 1.8).toFixed(2)}px)`;
  });
  const zIndex = useTransform(d, (v) => 100 - Math.round(Math.abs(v) * 10));
  const glow = useTransform(d, (v) => Math.max(0, 1 - Math.abs(v) * 1.6));
  const hidden = useTransform(d, (v) => (Math.abs(v) > 2.6 ? "hidden" : "visible"));

  const next = stats?.next ? dueLabel(stats.next.due, now) : null;
  const long = course.name.length > 12;

  return (
    <motion.div
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={`${course.name}${course.instructor ? `, ${course.instructor}` : ""}`}
      onClick={onTap}
      className="absolute left-1/2 top-4 cursor-pointer"
      style={{ width, height, marginLeft: -width / 2, x, rotateY, scale, opacity, zIndex, filter, visibility: hidden, ...accentStyle(course.color) }}
    >
      {/* Accent glow, centred card only. Opacity-only so it stays on the compositor. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-[20px]"
        style={{
          opacity: glow,
          background: "radial-gradient(70% 70% at 50% 60%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 75%)",
        }}
      />
      <div
        className="surface relative flex h-full flex-col justify-between overflow-hidden rounded-card p-4"
        style={{ boxShadow: "var(--inner-highlight), 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isNow && (
                <span className="flex items-center gap-1 rounded-full bg-accent px-1.5 py-px text-label font-medium text-on-accent">Now</span>
              )}
              <p className="truncate text-small text-gray-900">{course.instructor ?? " "}</p>
            </div>
          </div>
          {stats && <ProgressRing value={stats.progress} size={20} label={`${stats.weekDone} of ${stats.weekTotal} done this week`} />}
        </div>
        <div className="min-w-0">
          <h2
            className={`line-clamp-2 font-semibold tracking-[-0.02em] text-gray-1000 ${long ? "text-heading md:text-title" : "text-title md:text-display"}`}
          >
            {course.name}
          </h2>
          <p className="mt-1.5 flex items-center gap-1.5 truncate text-small text-gray-900">
            <span className="font-mono tabular text-gray-1000">{stats?.open ?? 0}</span> open
            {next && (
              <>
                <span aria-hidden="true">·</span>
                <span className={next.overdue ? "text-red" : ""}>next {next.text}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Dots({ n, pos, nowIndex }: { n: number; pos: MotionValue<number>; nowIndex: number | null }) {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Dot key={i} i={i} n={n} pos={pos} isNow={i === nowIndex} />
      ))}
    </div>
  );
}

function Dot({ i, n, pos, isNow }: { i: number; n: number; pos: MotionValue<number>; isNow: boolean }) {
  const near = useTransform(pos, (p) => Math.max(0, 1 - Math.abs(wrap(i - p, n))));
  const opacity = useTransform(near, (v) => 0.25 + v * 0.75);
  const scaleX = useTransform(near, (v) => 1 + v);
  return (
    <motion.span
      className={`block h-1.5 w-1.5 rounded-full ${isNow ? "bg-accent" : "bg-gray-1000"}`}
      style={{ opacity, scaleX }}
    />
  );
}

function NowButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.9 }}
      transition={spring.ui}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label="Back to the class happening now (.)"
      className="pressable absolute bottom-0 right-0 flex h-10 items-center gap-1.5 rounded-full border border-hairline-strong px-3 text-small text-gray-1000 hover:bg-gray-100"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <RotateCcw size={14} strokeWidth={1.5} /> Now
    </motion.button>
  );
}
