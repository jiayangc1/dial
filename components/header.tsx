"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { LogOut, Search, TriangleAlert, WifiOff, CloudUpload } from "lucide-react";
import { Mark } from "./logo";
import { Odometer, formatCountdown } from "./odometer";
import { accentStyle } from "@/lib/colors";
import { spring, fade } from "@/lib/motion";
import { signOutAction } from "@/app/actions";
import { clearSnapshotCache, type SyncState } from "@/lib/client/use-snapshot";
import type { NowState } from "@/lib/now";
import { useClock } from "@/lib/client/clock";
import { timezone } from "@/config/bells";
import type { Course, Snapshot } from "@/lib/types";

const timeFmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone });

export function Header({
  state,
  courseByName,
  data,
  sync,
  queued,
  onRetry,
  onSearch,
  onNow,
  initialNow,
}: {
  initialNow?: number | null;
  state: NowState | null;
  courseByName: Map<string, Course>;
  data: Snapshot | null;
  sync: SyncState;
  queued: number;
  onRetry: () => void;
  onSearch: () => void;
  onNow: () => void;
}) {
  // Only the header ticks every second (countdown + progress bar).
  const now = useClock(initialNow);
  let progress: number | null = null;
  let urgent = false;
  let accentCourse: Course | undefined;
  if (state?.kind === "in_class" && now) {
    const total = state.period.endsAt.getTime() - state.period.startsAt.getTime();
    const left = state.period.endsAt.getTime() - now.getTime();
    progress = 1 - left / total;
    urgent = left <= 5 * 60_000;
    accentCourse = courseByName.get(state.course);
  } else if (state?.kind === "passing") accentCourse = courseByName.get(state.next.course);

  return (
    <header className="glass sticky top-0 z-30 pt-[var(--safe-top)]" style={accentStyle(accentCourse?.color)}>
      <div className="mx-auto flex h-14 w-full max-w-[640px] items-center gap-2 px-4 md:px-6">
        <a href="/app" className="pressable -ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-gray-1000 hover:bg-gray-100" aria-label="Dial">
          <Mark size={20} />
        </a>
        <button onClick={onNow} className="pressable -ml-1 min-w-0 flex-1 rounded-md py-1 text-left" title="Jump to now (.)">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={state?.kind ?? "loading"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fade}>
              <Status state={state} now={now} />
            </m.div>
          </AnimatePresence>
        </button>
        <div className="flex shrink-0 items-center">
          {data?.demo && <span className="mr-1 hidden rounded-full border border-hairline px-2 py-0.5 text-label text-gray-900 sm:inline">Demo</span>}
          <SyncBadge sync={sync} queued={queued} onRetry={onRetry} />
          <button onClick={onSearch} aria-label="Search tasks (/)" className="pressable flex size-11 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100 hover:text-gray-1000">
            <Search size={20} strokeWidth={1.5} />
          </button>
          <AccountMenu data={data} />
        </div>
      </div>
      {/* Hairline that doubles as the period progress bar. */}
      <div className="relative h-px bg-hairline">
        <ProgressBar progress={progress} urgent={urgent} />
      </div>
    </header>
  );
}

function ProgressBar({ progress, urgent }: { progress: number | null; urgent: boolean }) {
  // Plain CSS: this updates every second, and a CSS transition costs nothing on the main thread.
  if (progress === null) return null;
  return (
    <div
      className={`period-bar absolute inset-x-0 -top-px h-[2px] origin-left bg-accent ${urgent ? "period-bar-urgent" : ""}`}
      style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
    />
  );
}

function Status({ state, now }: { state: NowState | null; now: Date | null }) {
  if (!state || !now) return <div className="skeleton h-3.5 w-32" />;
  switch (state.kind) {
    case "in_class": {
      const left = state.period.endsAt.getTime() - now.getTime();
      return (
        <p className="flex items-baseline gap-2 truncate text-body">
          <span className="truncate font-medium text-gray-1000">{state.course}</span>
          <span className="flex shrink-0 items-baseline gap-1 text-small text-gray-900">
            <Odometer value={formatCountdown(left)} />
            <span>left</span>
          </span>
          <span className="sr-only">{Math.ceil(left / 60000)} minutes left</span>
        </p>
      );
    }
    case "passing": {
      const mins = Math.max(1, Math.ceil((state.next.startsAt.getTime() - now.getTime()) / 60000));
      return (
        <p className="flex items-center gap-2 truncate text-body">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline-strong px-2 py-0.5 text-label text-gray-1000">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Next up · <span className="font-mono tabular">{mins} min</span>
          </span>
          <span className="truncate text-gray-1000">{state.next.course}</span>
        </p>
      );
    }
    case "before_school":
      return (
        <p className="truncate text-body">
          <span className="font-medium text-gray-1000">Before school</span>
          {state.first && <span className="text-small text-gray-900"> · first bell <span className="font-mono tabular">{timeFmt(state.first.startsAt)}</span></span>}
        </p>
      );
    case "after_school":
      return <p className="truncate text-body font-medium text-gray-1000">Tonight</p>;
    case "weekend":
      return <p className="truncate text-body font-medium text-gray-1000">Weekend</p>;
    case "no_school":
      return <p className="truncate text-body font-medium text-gray-1000">No school today</p>;
  }
}

function SyncBadge({ sync, queued, onRetry }: { sync: SyncState; queued: number; onRetry: () => void }) {
  const show = sync.kind === "offline" ? "offline" : sync.kind === "error" ? "error" : queued > 0 ? "queued" : null;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.button
          key={show}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={spring.ui}
          onClick={show === "error" ? onRetry : undefined}
          title={sync.kind === "error" ? sync.message : undefined}
          role="status"
          className="pressable mr-1 flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline px-2.5 text-label text-gray-900"
        >
          {show === "offline" && (
            <>
              <WifiOff size={12} strokeWidth={1.5} /> Offline{queued ? <span className="font-mono tabular"> · {queued} will sync</span> : null}
            </>
          )}
          {show === "queued" && (
            <>
              <CloudUpload size={12} strokeWidth={1.5} /> <span className="font-mono tabular">{queued}</span> will sync
            </>
          )}
          {show === "error" && (
            <>
              <TriangleAlert size={12} strokeWidth={1.5} className="text-red" /> <span className="hidden sm:inline">Notion error ·</span> Retry
            </>
          )}
        </m.button>
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
          <span className="flex size-7 items-center justify-center rounded-full border border-hairline bg-gray-200 text-label font-medium text-gray-1000">{initial}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
            <m.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={spring.ui}
              style={{ transformOrigin: "top right" }}
              className="glass absolute right-0 top-12 z-20 w-60 overflow-hidden rounded-sheet border border-hairline p-1"
            >
              <div className="px-3 py-2">
                <p className="truncate text-body text-gray-1000">{data?.user.name ?? "Signed in"}</p>
                <p className="truncate text-small text-gray-900">{data?.user.workspace ?? "Notion"}</p>
              </div>
              <div className="hidden px-3 pb-2 pt-1 text-label text-gray-900 md:block">
                <Kbd>n</Kbd> new · <Kbd>←</Kbd>
                <Kbd>→</Kbd> class · <Kbd>.</Kbd> now · <Kbd>/</Kbd> search
              </div>
              <form action={signOutAction} onSubmit={clearSnapshotCache}>
                <button role="menuitem" className="pressable flex h-11 w-full items-center gap-2 rounded-card px-3 text-body text-gray-1000 hover:bg-gray-100">
                  <LogOut size={16} strokeWidth={1.5} /> Sign out
                </button>
              </form>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-hairline-strong bg-gray-100 px-1 font-mono text-label text-gray-1000">{children}</kbd>;
}
