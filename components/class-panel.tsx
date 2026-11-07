"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import { TaskRow, type RowActions } from "./task-row";
import { groupTasks } from "@/lib/tasks";
import { startOfWeek, dateKey } from "@/lib/time";
import { timezone } from "@/config/bells";
import { spring, fade, easeOut } from "@/lib/motion";
import type { ClientTask } from "@/lib/client/task-store";
import type { Course } from "@/lib/types";

type Props = {
  course: Course;
  tasks: ClientTask[];
  now: Date;
  actions: RowActions;
  onAddFirst: () => void;
  /** Direction of the wheel move that brought this class in: list enters from that side. */
  dir: number;
};

export function ClassPanel({ course, tasks, now, actions, onAddFirst, dir }: Props) {
  const g = groupTasks(tasks, course.id, now) as { soon: ClientTask[]; later: ClientTask[]; done: ClientTask[] };
  const [showDone, setShowDone] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => (mounted.current = true), 50);
    return () => clearTimeout(t);
  }, []);
  const open = g.soon.length + g.later.length;

  let i = 0;
  const row = (t: ClientTask) => <Row key={t.key} task={t} now={now} actions={actions} index={i++} dir={dir} mounted={mounted} />;

  return (
    <div className="pb-4">
      {open === 0 ? (
        g.done.length ? <AllDone course={course} now={now} /> : <Empty course={course} onAdd={onAddFirst} />
      ) : (
        <>
          <Group label="Due soon" count={g.soon.length}>
            {g.soon.map(row)}
          </Group>
          <Group label="Later" count={g.later.length}>
            {g.later.map(row)}
          </Group>
        </>
      )}

      {g.done.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
            className="pressable flex h-11 items-center gap-1.5 rounded-card px-3 text-small text-gray-900 hover:text-gray-1000"
          >
            <motion.span animate={{ rotate: showDone ? 90 : 0 }} transition={spring.ui} className="flex">
              <ChevronRight size={16} strokeWidth={1.5} />
            </motion.span>
            Done this week <span className="font-mono tabular text-gray-600">· {g.done.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                <AnimatePresence initial={false}>{g.done.map((t) => <Row key={t.key} task={t} now={now} actions={actions} index={0} dir={0} mounted={mounted} />)}</AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.h3
            key="h"
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            className="px-3 pb-1 pt-4 text-label uppercase tracking-[0.04em] text-gray-900"
          >
            {label} <span className="font-mono tabular text-gray-600">· {count}</span>
          </motion.h3>
        )}
      </AnimatePresence>
      <AnimatePresence initial={true}>{children}</AnimatePresence>
    </section>
  );
}

function Row({
  task,
  now,
  actions,
  index,
  dir,
  mounted,
}: {
  task: ClientTask;
  now: Date;
  actions: RowActions;
  index: number;
  dir: number;
  mounted: React.RefObject<boolean>;
}) {
  const reduced = useReducedMotion();
  // First paint of a class: stagger in from the swipe side, 30ms per row.
  // Later additions: spring up out of the add bar.
  const added = mounted.current;
  const initial = reduced ? { opacity: 0 } : added ? { opacity: 0, y: 28, scale: 0.96 } : { opacity: 0, x: 12 * dir };
  return (
    <motion.div
      layout={!reduced}
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.24, ease: easeOut } }}
      transition={added ? spring.ui : { ...spring.ui, delay: Math.min(index, 12) * 0.03 }}
      className="overflow-hidden"
    >
      <TaskRow task={task} now={now} actions={actions} />
    </motion.div>
  );
}

/** An open ring with one lit dot: the Dial mark, waiting for its first task. */
function RingArt() {
  const holes = 10;
  return (
    <svg width="72" height="72" viewBox="-36 -36 72 72" aria-hidden="true">
      <circle r="27" fill="none" stroke="var(--hairline-strong)" strokeWidth="1.5" strokeDasharray="2 5" />
      {Array.from({ length: holes }, (_, i) => {
        const a = (i / holes) * Math.PI * 2 - Math.PI / 2;
        return <circle key={i} cx={Math.cos(a) * 27} cy={Math.sin(a) * 27} r={i === 0 ? 3.5 : 2.5} fill={i === 0 ? "var(--accent)" : "var(--gray-500)"} />;
      })}
      <path d="M-7 0.5 -2 5.5 8 -5" fill="none" stroke="var(--gray-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Empty({ course, onAdd }: { course: Course; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <RingArt />
      <h3 className="mt-4 text-heading font-semibold tracking-[-0.01em] text-gray-1000">A clean slate</h3>
      <p className="mt-1 max-w-[280px] text-body text-gray-900">Nothing on the list for {course.name}. Add the first thing you need to do.</p>
      <button onClick={onAdd} className="pressable mt-5 flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-4 text-body text-gray-1000 hover:bg-gray-100">
        <Plus size={16} strokeWidth={1.5} /> Add the first task
      </button>
    </div>
  );
}

function AllDone({ course, now }: { course: Course; now: Date }) {
  const reduced = useReducedMotion();
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    // Confetti only the first time a class is cleared each week.
    const key = `dial.cleared.${course.id}.${dateKey(startOfWeek(now, timezone), timezone)}`;
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCelebrate(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  return (
    <div className="relative flex flex-col items-center px-6 py-12 text-center">
      {celebrate && !reduced && <Confetti />}
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.ui} className="relative">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="26" fill="color-mix(in srgb, var(--accent) 14%, transparent)" />
          <motion.path
            d="M18 28.5 25 35.5 39 21"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.15, ease: easeOut }}
          />
        </svg>
      </motion.div>
      <h3 className="mt-4 text-heading font-semibold tracking-[-0.01em] text-gray-1000">Nothing due in {course.name} 🎉</h3>
      <p className="mt-1 text-body text-gray-900">Everything&rsquo;s done for now.</p>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 22 }, (_, i) => {
    const a = -Math.PI / 2 + ((i / 21) - 0.5) * Math.PI * 1.3;
    const r = 70 + ((i * 37) % 60);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, rot: ((i * 53) % 180) - 90, w: i % 3 ? 4 : 6, h: i % 2 ? 8 : 4, o: i % 4 === 0 ? 0.5 : 1 };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-[76px]" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-[1px] bg-accent"
          style={{ width: b.w, height: b.h, opacity: b.o }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 60], rotate: b.rot * 3, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 1.3, ease: easeOut, times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
