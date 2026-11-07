"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ChevronRight, LogOut, TriangleAlert, WifiOff } from "lucide-react";
import { Mark, Wordmark } from "./logo";
import { TaskRow } from "./task-row";
import { ProgressRing } from "./progress-ring";
import { useSnapshot, clearSnapshotCache, type SyncState } from "@/lib/client/use-snapshot";
import { accentStyle } from "@/lib/colors";
import { orderCourses } from "@/lib/schedule";
import { courseStats, groupTasks } from "@/lib/tasks";
import { startOfWeek } from "@/lib/time";
import { timezone } from "@/config/bells";
import { fade, spring } from "@/lib/motion";
import { signOutAction } from "@/app/actions";
import type { Course, Snapshot, Task } from "@/lib/types";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function DialApp() {
  const { data, sync, reload } = useSnapshot();
  const now = useNow();
  const ready = data && now;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh">
        <Header data={data} sync={sync} onRetry={reload} />
        <main className="mx-auto w-full max-w-[640px] px-4 pb-[calc(var(--safe-bottom)+48px)] md:px-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {ready ? (
              <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
                <Overview data={data} now={now} />
              </motion.div>
            ) : (
              <motion.div key="skeleton" exit={{ opacity: 0 }} transition={fade}>
                <OverviewSkeleton />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}

function Header({ data, sync, onRetry }: { data: Snapshot | null; sync: SyncState; onRetry: () => void }) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-hairline pt-[var(--safe-top)]">
      <div className="mx-auto flex h-14 w-full max-w-[640px] items-center gap-3 px-4 md:px-6">
        <a href="/app" className="pressable -ml-1 flex items-center gap-2 rounded-md p-1 text-gray-1000" aria-label="Dial home">
          <Mark size={20} />
          <Wordmark height={16} className="-ml-0.5" />
        </a>
        {data?.demo && <span className="rounded-full border border-hairline px-2 py-0.5 text-label text-gray-900">Demo data</span>}
        <div className="ml-auto flex items-center gap-1">
          <SyncBadge sync={sync} onRetry={onRetry} />
          <AccountMenu data={data} />
        </div>
      </div>
    </header>
  );
}

function SyncBadge({ sync, onRetry }: { sync: SyncState; onRetry: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {sync.kind === "offline" && (
        <motion.span
          key="offline"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={spring.ui}
          className="flex h-7 items-center gap-1.5 rounded-full border border-hairline px-2.5 text-label text-gray-900"
          role="status"
        >
          <WifiOff size={12} strokeWidth={1.5} /> Offline
        </motion.span>
      )}
      {sync.kind === "error" && (
        <motion.button
          key="error"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={spring.ui}
          onClick={onRetry}
          title={sync.message}
          className="pressable flex h-7 items-center gap-1.5 rounded-full border border-hairline px-2.5 text-label text-gray-1000 hover:bg-gray-100"
        >
          <TriangleAlert size={12} strokeWidth={1.5} className="text-red" /> Notion error · Retry
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function AccountMenu({ data }: { data: Snapshot | null }) {
  const [open, setOpen] = useState(false);
  const initial = (data?.user.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account"
        className="pressable flex size-11 items-center justify-center rounded-full hover:bg-gray-100"
      >
        {data?.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.user.image} alt="" className="size-7 rounded-full border border-hairline" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full border border-hairline bg-gray-200 text-label font-medium text-gray-1000">
            {initial}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={spring.ui}
              style={{ transformOrigin: "top right" }}
              className="glass absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-sheet border border-hairline p-1"
            >
              <div className="px-3 py-2">
                <p className="truncate text-body text-gray-1000">{data?.user.name ?? "Signed in"}</p>
                <p className="truncate text-small text-gray-900">{data?.user.workspace ?? "Notion"}</p>
              </div>
              <form action={signOutAction} onSubmit={clearSnapshotCache}>
                <button role="menuitem" className="pressable flex h-11 w-full items-center gap-2 rounded-card px-3 text-body text-gray-1000 hover:bg-gray-100">
                  <LogOut size={16} strokeWidth={1.5} /> Sign out
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Overview({ data, now }: { data: Snapshot; now: Date }) {
  const courses = useMemo(() => orderCourses(data.courses), [data.courses]);
  const weekStart = startOfWeek(now, timezone);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <h2 className="text-heading font-semibold text-gray-1000">No enrolled classes</h2>
        <p className="mt-2 max-w-[320px] text-body text-gray-900">Tick &ldquo;Currently enrolled&rdquo; on your classes in Notion and they&rsquo;ll show up here.</p>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <p className="px-3 text-label uppercase tracking-[0.04em] text-gray-900">
        {courses.length} classes · {data.tasks.filter((t) => t.statusGroup !== "complete").length} open
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {courses.map((c) => (
          <CourseSection key={c.id} course={c} tasks={data.tasks} now={now} stats={courseStats(data.tasks, c.id, weekStart, weekEnd)} />
        ))}
      </div>
    </div>
  );
}

function CourseSection({
  course,
  tasks,
  now,
  stats,
}: {
  course: Course;
  tasks: Task[];
  now: Date;
  stats: ReturnType<typeof courseStats>;
}) {
  const g = groupTasks(tasks, course.id, now);
  const [showDone, setShowDone] = useState(false);
  const empty = g.soon.length + g.later.length === 0;

  return (
    <section style={accentStyle(course.color)} className="border-t border-hairline pt-4 first:border-t-0" aria-labelledby={`c-${course.id}`}>
      <div className="flex items-center gap-3 px-3">
        <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id={`c-${course.id}`} className="truncate text-lead font-semibold tracking-[-0.01em] text-gray-1000">
            {course.name}
          </h2>
          {course.instructor && <p className="truncate text-small text-gray-900">{course.instructor}</p>}
        </div>
        <span className="font-mono text-small tabular text-gray-900" aria-label={`${stats.open} open`}>
          {stats.open}
        </span>
        <ProgressRing value={stats.progress} />
      </div>

      <div className="mt-2 pb-2">
        {empty ? (
          <p className="px-3 py-3 text-body text-gray-900">{g.done.length ? `Nothing due in ${course.name} 🎉` : "Nothing here yet."}</p>
        ) : (
          <>
            <Group label="Due soon" tasks={g.soon} now={now} />
            <Group label="Later" tasks={g.later} now={now} />
          </>
        )}
        {g.done.length > 0 && (
          <div>
            <button
              onClick={() => setShowDone((s) => !s)}
              aria-expanded={showDone}
              className="pressable flex h-11 items-center gap-1.5 rounded-card px-3 text-small text-gray-900 hover:text-gray-1000"
            >
              <motion.span animate={{ rotate: showDone ? 90 : 0 }} transition={spring.ui} className="flex">
                <ChevronRight size={14} strokeWidth={1.5} />
              </motion.span>
              Done this week · <span className="font-mono tabular">{g.done.length}</span>
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                  {g.done.map((t) => (
                    <TaskRow key={t.id} task={t} now={now} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

function Group({ label, tasks, now }: { label: string; tasks: Task[]; now: Date }) {
  if (!tasks.length) return null;
  return (
    <div className="mt-1">
      <h3 className="px-3 pb-1 pt-2 text-label uppercase tracking-[0.04em] text-gray-900">
        {label} <span className="font-mono tabular text-gray-600">· {tasks.length}</span>
      </h3>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} now={now} />
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="pt-6" aria-busy="true" aria-label="Loading your classes">
      <div className="skeleton mx-3 h-3 w-32" />
      {[0, 1, 2].map((s) => (
        <div key={s} className={`mt-2 pt-4 ${s ? "border-t border-hairline" : ""}`}>
          <div className="flex items-center gap-3 px-3">
            <div className="skeleton size-2.5 rounded-full" />
            <div className="flex-1">
              <div className="skeleton h-4" style={{ width: `${[38, 52, 30][s]}%` }} />
              <div className="skeleton mt-1.5 h-3 w-20" />
            </div>
            <div className="skeleton size-5 rounded-full" />
          </div>
          {[0, 1].map((r) => (
            <div key={r} className="flex min-h-14 items-start gap-3 px-3 py-3">
              <div className="skeleton size-5 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-3.5" style={{ width: `${[64, 48, 56, 40, 70, 52][s * 2 + r]}%` }} />
                <div className="skeleton mt-2 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
