"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { MotionRoot } from "./motion-root";
import { Header, Kbd } from "./header";
import { ClassPanel } from "./class-panel";
import { Tonight } from "./tonight";
import { Composer, type ComposerHandle } from "./composer";
import dynamic from "next/dynamic";
import { WifiOff } from "lucide-react";
import { ToastProvider, useToasts } from "./toasts";
import { useSnapshot } from "@/lib/client/use-snapshot";
import { useMinuteClock } from "@/lib/client/clock";
import { onWarm } from "@/lib/client/warm";
import { TaskStore } from "@/lib/client/task-store";
import { accentStyle } from "@/lib/colors";
import { bellConfig } from "@/lib/bells";
import { focusCourse, isTonight, nowState } from "@/lib/now";
import { orderCourses } from "@/lib/schedule";
import { courseStats } from "@/lib/tasks";
import { startOfWeek } from "@/lib/time";
import { timezone } from "@/config/bells";
import { fade, easeOut } from "@/lib/motion";
import type { NewTask, Snapshot, TaskPatch } from "@/lib/types";
import type { RowActions } from "./task-row";

// Sheets aren't needed for first paint; load them in the background.
const EditSheet = dynamic(() => import("./edit-sheet").then((m) => m.EditSheet), { ssr: false });
const SearchSheet = dynamic(() => import("./search-sheet").then((m) => m.SearchSheet), { ssr: false });


function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

/** The server-rendered first view: data, the clock it was rendered at, and when it was fetched. */
export type InitialView = { snapshot: Snapshot; now: number; requestedAt: number; scenario: string | null } | null;

export function DialApp({ initial }: { initial: InitialView }) {
  const desktop = useMediaQuery("(min-width: 768px)");
  return (
    <MotionRoot>
      <ToastProvider bottomOffset={desktop ? 24 : 16}>
        <Dial desktop={desktop} initial={initial} />
      </ToastProvider>
    </MotionRoot>
  );
}

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

function Dial({ desktop, initial }: { desktop: boolean; initial: InitialView }) {
  useServiceWorker();
  const { data, sync, reload } = useSnapshot(initial ? { ...initial.snapshot, requestedAt: initial.requestedAt } : null);
  const now = useMinuteClock(initial?.now);
  const toasts = useToasts();
  const reduced = useReducedMotion();

  // ── Optimistic store ────────────────────────────────────────────────
  // Seeded with the server-rendered tasks so hydration matches the HTML; the
  // offline queue (localStorage) is replayed on top right after mount.
  const [store] = useState(() => new TaskStore(initial?.snapshot.tasks));
  useEffect(() => store.loadQueue(), [store]);
  const tasks = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const queued = useSyncExternalStore(store.subscribe, () => store.queuedCount, () => 0);
  // The store was seeded with the first snapshot; only later polls need applying
  // (re-applying the seed would rebuild every row right after hydration).
  const seed = useRef(data);
  useEffect(() => {
    if (data && data !== seed.current) store.setServer(data.tasks, data.requestedAt);
  }, [store, data]);
  const reloadSoon = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    store.setEvents({
      onError: (message, retry) => toasts.push({ message: `Couldn't save: ${message}`, tone: "error", action: { label: "Retry", run: retry }, duration: 8000 }),
      onReauth: () => window.location.replace("/auth/expired"),
      onSynced: () => {
        clearTimeout(reloadSoon.current);
        reloadSoon.current = setTimeout(() => void reload(), 1500);
      },
    });
    const online = () => store.flush();
    window.addEventListener("online", online);
    if (navigator.onLine && store.queuedCount) store.flush();
    return () => window.removeEventListener("online", online);
  }, [store, toasts, reload]);

  // ── Classes, stats and "now" ────────────────────────────────────────
  const courses = useMemo(() => (data ? orderCourses(data.courses) : []), [data]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const courseByName = useMemo(() => new Map(courses.map((c) => [c.name, c])), [courses]);
  const state = useMemo(() => (now ? nowState(now, bellConfig) : null), [now]);
  const nowName = state ? focusCourse(state) : null;
  const nowIdx = nowName ? courses.findIndex((c) => c.name === nowName) : -1;
  const nowIndex = nowIdx >= 0 ? nowIdx : null;

  const dayKey = now?.toDateString();
  const openCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (!now) return m;
    const ws = startOfWeek(now, timezone);
    const we = new Date(ws.getTime() + 7 * 86_400_000);
    for (const c of courses) m.set(c.id, courseStats(tasks, c.id, ws, we).open);
    return m;
    // Recompute on task changes and once a day, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, tasks, dayKey]);

  // ── Selection ───────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 0 until the first class change: the first panel paints without a stagger.
  const [dir, setDir] = useState(0);
  const selectedIndex = Math.max(0, courses.findIndex((c) => c.id === selectedId));
  const selected = courses[selectedIndex] ?? null;

  // Open on the class happening now (or the first class).
  if (!selectedId && courses.length && state) {
    setSelectedId(nowIndex !== null ? courses[nowIndex].id : courses[0].id);
  }

  // When a period ends with the app open, roll to the next class, unless
  // you'd wandered off to look at a different one.
  const prevNow = useRef<string | null>(null);
  useEffect(() => {
    if (!nowName) {
      prevNow.current = null;
      return;
    }
    if (prevNow.current && prevNow.current !== nowName) {
      const prev = courseByName.get(prevNow.current);
      const next = courseByName.get(nowName);
      if (next && (!prev || selectedId === prev.id)) {
         
        setDir(1);
        setSelectedId(next.id);
      }
    }
    prevNow.current = nowName;
  }, [nowName, courseByName, selectedId]);

  const selectId = useCallback(
    (id: string) => {
      const to = courses.findIndex((c) => c.id === id);
      setDir(to >= selectedIndex ? 1 : -1);
      setSelectedId(id);
    },
    [courses, selectedIndex],
  );

  const selectIndex = useCallback(
    (i: number, d: 1 | -1) => {
      const c = courses[((i % courses.length) + courses.length) % courses.length];
      if (!c) return;
      setDir(d);
      setSelectedId(c.id);
    },
    [courses],
  );
  const jumpNow = useCallback(() => {
    if (nowIndex === null) return;
    setDir(nowIndex > selectedIndex ? 1 : -1);
    setSelectedId(courses[nowIndex].id);
  }, [nowIndex, selectedIndex, courses]);

  // ── Page title: "Pre-Calc · 22m · Dial" ─────────────────────────────
  useEffect(() => {
    if (!state || !now) return;
    let title = "Dial";
    if (state.kind === "in_class") title = `${state.course} · ${Math.ceil((state.period.endsAt.getTime() - now.getTime()) / 60000)}m · Dial`;
    else if (state.kind === "passing") title = `Next: ${state.next.course} · ${Math.ceil((state.next.startsAt.getTime() - now.getTime()) / 60000)}m · Dial`;
    else if (state.kind === "after_school") title = "Tonight · Dial";
    else if (state.kind === "weekend") title = "Weekend · Dial";
    if (document.title !== title) document.title = title;
  }, [state, now]);

  // ── Sheets ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ key: string; focus?: "due" } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const editingTask = editing ? (tasks.find((t) => t.key === editing.key) ?? null) : null;
  // The sheets' code loads once the app is warm (first touch, or quiet), not during hydration.
  const [sheetsWanted, setSheetsWanted] = useState(false);
  useEffect(() => onWarm(() => setSheetsWanted(true)), []);
  const sheetOpen = !!editingTask || searchOpen;
  const addBar = useRef<ComposerHandle>(null);

  // ── Actions (all optimistic) ────────────────────────────────────────
  const actions: RowActions = useMemo(
    () => ({
      onComplete: (t) => {
        const prev = t.status;
        store.update(t.key, { status: "Submitted" });
        toasts.push({ message: `Completed “${t.title}”`, action: { label: "Undo", run: () => store.update(t.key, { status: prev as TaskPatch["status"] }) } });
      },
      onReopen: (t) => store.update(t.key, { status: "Not started" }),
      onStatus: (t, status) => {
        const prev = t.status;
        store.update(t.key, { status });
        toasts.push({
          message: status === "In progress" ? "Marked in progress" : "Marked need to submit",
          action: { label: "Undo", run: () => store.update(t.key, { status: prev as TaskPatch["status"] }) },
        });
      },
      onDelete: (t) => {
        store.trash(t.key);
        toasts.push({ message: `Deleted “${t.title}”`, action: { label: "Undo", run: () => store.restore(t) } });
      },
      onOpen: (t, focus) => setEditing({ key: t.key, focus }),
    }),
    [store, toasts],
  );

  const onAdd = useCallback(
    (input: NewTask) => {
      store.create(input);
      if (input.courseId !== selectedId) {
        const c = courseById.get(input.courseId);
        toasts.push({
          message: `Added to ${c?.name ?? "another class"}`,
          action: {
            label: "View",
            run: () => {
              setDir(1);
              setSelectedId(input.courseId);
            },
          },
          duration: 3500,
        });
      }
    },
    [store, selectedId, courseById, toasts],
  );

  // ── Keyboard shortcuts: n, ←/→, ., / ───────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || sheetOpen) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=listbox]")) return;
      if (e.key === "n") {
        e.preventDefault();
        addBar.current?.focus();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectIndex(selectedIndex + 1, 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectIndex(selectedIndex - 1, -1);
      } else if (e.key === ".") {
        e.preventDefault();
        jumpNow();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, selectIndex, selectedIndex, jumpNow]);

  const ready = !!(data && now && state);

  // Desktop: the cursor waits in the add bar as soon as the app is ready.
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (desktop && ready && !focusedOnce.current) {
      focusedOnce.current = true;
      setTimeout(() => addBar.current?.focus(), 80);
    }
  }, [desktop, ready]);

  const tonight = state ? isTonight(state) : false;


  return (
    <>
      <m.div
        className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-bg"
        style={{ ...accentStyle(selected?.color), transformOrigin: "50% 0%" }}
        initial={false}
        animate={reduced ? undefined : { scale: sheetOpen ? 0.96 : 1, borderRadius: sheetOpen ? 12 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
      >
        <Header
          state={state}
          courseByName={courseByName}
          data={data}
          sync={sync}
          queued={queued}
          initialNow={initial?.now}
          onRetry={() => void reload()}
          onSearch={() => setSearchOpen(true)}
          onNow={jumpNow}
        />

        <main className="mx-auto w-full max-w-[640px] px-4 pb-[calc(var(--safe-bottom)+96px)] md:px-6 md:pb-16">
          <AnimatePresence mode="popLayout" initial={false}>
            {!ready && sync.kind === "offline" && !data ? (
              <m.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade} className="flex flex-col items-center py-24 text-center">
                <WifiOff size={24} strokeWidth={1.5} className="text-gray-900" />
                <h2 className="mt-4 text-heading font-semibold text-gray-1000">You&rsquo;re offline</h2>
                <p className="mt-2 max-w-[300px] text-body text-gray-900">Dial will load your classes as soon as you&rsquo;re back online.</p>
              </m.div>
            ) : !ready ? (
              <m.div key="skeleton" exit={{ opacity: 0 }} transition={fade}>
                <AppSkeleton />
              </m.div>
            ) : courses.length === 0 ? (
              <m.div key="no-classes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade} className="flex flex-col items-center py-24 text-center">
                <h2 className="text-heading font-semibold text-gray-1000">No enrolled classes</h2>
                <p className="mt-2 max-w-[320px] text-body text-gray-900">Tick &ldquo;Currently enrolled&rdquo; on your classes in Notion and they&rsquo;ll appear here.</p>
              </m.div>
            ) : (
              <m.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
                <div className="pt-4">
                  <Composer
                    ref={addBar}
                    courses={courses}
                    selected={selected}
                    nowId={nowIndex !== null ? courses[nowIndex].id : null}
                    nowLabel={state?.kind === "passing" ? "Next" : "Now"}
                    openCounts={openCounts}
                    onSelect={selectId}
                    now={now!}
                    onAdd={onAdd}
                  />
                </div>

                {tonight && <Tonight state={state!} tasks={tasks} courses={courseById} now={now!} actions={actions} />}
                {tonight && selected && (
                  <p className="flex items-center gap-2 px-3 pb-1 pt-8 text-label uppercase tracking-[0.04em] text-gray-900">
                    <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {selected.name}
                  </p>
                )}

                <div className="relative mt-2">
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    {selected && (
                      <m.div
                        key={selected.id}
                        custom={dir}
                        variants={{
                          enter: { opacity: 0 },
                          center: { opacity: 1 },
                          exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : -12 * d }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.18, ease: easeOut }}
                      >
                        <ClassPanel course={selected} tasks={tasks} now={now!} actions={actions} dir={dir} instant={dir === 0} onAddFirst={() => addBar.current?.focus()} />
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>

                {desktop && (
                  <p className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-label text-gray-900">
                    <span>
                      <Kbd>n</Kbd> new task
                    </span>
                    <span>
                      <Kbd>←</Kbd>
                      <Kbd>→</Kbd> switch class
                    </span>
                    <span>
                      <Kbd>.</Kbd> now
                    </span>
                    <span>
                      <Kbd>/</Kbd> search
                    </span>
                  </p>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </main>

      </m.div>

      {now && (sheetsWanted || editing || searchOpen) && (
        <>
          <EditSheet
            task={editingTask}
            course={editingTask ? (courseById.get(editingTask.courseIds[0]) ?? null) : null}
            focus={editing?.focus}
            now={now}
            onClose={() => setEditing(null)}
            onSave={(t, patch) => store.update(t.key, patch)}
            onDelete={actions.onDelete}
          />
          <SearchSheet
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            tasks={tasks}
            courses={courseById}
            now={now}
            onPick={(t) => {
              setSearchOpen(false);
              const c = t.courseIds.find((id) => courseById.has(id));
              if (c) {
                setDir(1);
                setSelectedId(c);
              }
              setTimeout(() => setEditing({ key: t.key }), 260);
            }}
          />
        </>
      )}
    </>
  );
}

/** Same geometry as the real screen: entry box, then rows. */
function AppSkeleton() {
  return (
    <div className="pt-4" aria-busy="true" aria-label="Loading your classes">
      <div className="surface rounded-sheet">
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-4">
          <div className="skeleton size-2.5 rounded-full" />
          <div className="skeleton h-3.5 w-28" />
        </div>
        <div className="flex h-[52px] items-center px-4">
          <div className="skeleton h-3.5 w-44" />
        </div>
      </div>
      <div className="mt-2">
        <div className="skeleton mx-3 mb-2 mt-4 h-3 w-20" />
        {[64, 48, 56, 40].map((w, i) => (
          <div key={i} className="flex min-h-14 items-start gap-3 px-3 py-3">
            <div className="skeleton size-5 shrink-0 rounded-full" />
            <div className="flex-1">
              <div className="skeleton h-3.5" style={{ width: `${w}%` }} />
              <div className="skeleton mt-2 h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
