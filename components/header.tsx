"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, m } from "motion/react";
import { Command, LogOut, Search, TriangleAlert, WifiOff, CloudUpload } from "lucide-react";
import { Mark } from "./logo";
import { Odometer, formatCountdown } from "./odometer";
import { Popover } from "./ui/popover";
import { Tooltip } from "./ui/tooltip";
import { Kbd } from "./ui/controls";
import { isMac } from "@/lib/client/platform";
import { accentStyle } from "@/lib/colors";
import { spring, fade } from "@/lib/motion";
import { signOutAction } from "@/app/actions";
import { clearSnapshotCache, type SyncState } from "@/lib/client/use-snapshot";
import type { NowState } from "@/lib/now";
import { useClock } from "@/lib/client/clock";
import { timezone } from "@/config/bells";
import type { Course, Snapshot } from "@/lib/types";

const noopSubscribe = () => () => {};
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
        <div className="min-w-0 flex-1">
          <Tooltip content={<>Jump to now <span className="opacity-60">·</span> .</>} className="flex max-w-full">
            <button onClick={onNow} className="pressable -ml-1 block max-w-full rounded-md px-1 py-1 text-left">
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={state?.kind ?? "loading"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fade}>
                  <Status state={state} now={now} />
                </m.div>
              </AnimatePresence>
            </button>
          </Tooltip>
        </div>
        <div className="flex shrink-0 items-center">
          {data?.demo && <span className="mr-1 hidden rounded-full border border-hairline px-2 py-0.5 text-label text-gray-900 sm:inline">Demo</span>}
          <SyncBadge sync={sync} queued={queued} onRetry={onRetry} />
          <SearchTrigger onClick={onSearch} />
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
          aria-label={sync.kind === "error" ? `Notion error: ${sync.message}. Retry` : undefined}
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

function SearchTrigger({ onClick }: { onClick: () => void }) {
  // Unknown during SSR; filled in on the client without a hydration mismatch.
  const mac = useSyncExternalStore(noopSubscribe, isMac, () => null);
  return (
    <>
      {/* Phone: an icon. Desktop: a Vercel-style search field that opens the command menu. */}
      <button onClick={onClick} aria-label="Search and commands" className="pressable flex size-11 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100 hover:text-gray-1000 md:hidden">
        <Search size={20} strokeWidth={1.5} />
      </button>
      <button
        onClick={onClick}
        aria-label="Search and commands"
        aria-keyshortcuts="Meta+K Control+K"
        className="field pressable mr-1 hidden h-8 w-[200px] items-center gap-2 rounded-full pl-3 pr-1.5 text-small text-gray-900 hover:text-gray-1000 md:flex"
      >
        <Search size={14} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search…</span>
        <span className={`flex items-center gap-0.5 transition-opacity duration-150 ${mac === null ? "opacity-0" : "opacity-100"}`} aria-hidden="true">
          <Kbd>{mac ? <Command size={11} strokeWidth={2} /> : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
    </>
  );
}

function AccountMenu({ data }: { data: Snapshot | null }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initial = (data?.user.name ?? "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <>
      <Tooltip content="Account" align="end">
        <button
          ref={trigger}
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
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} anchor={trigger} align="end" width={240} label="Account">
        <div ref={menu} role="menu" aria-label="Account" className="p-1">
          <div className="flex items-center gap-3 px-3 py-2.5">
            {data?.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.user.image} alt="" className="size-8 shrink-0 rounded-full border border-hairline" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-gray-200 text-small font-medium text-gray-1000">{initial}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-body text-gray-1000">{data?.user.name ?? "Signed in"}</span>
              <span className="block truncate text-small text-gray-900">{data?.user.workspace ?? "Notion"}</span>
            </span>
          </div>
          <div className="mx-2 my-1 h-px bg-hairline" />
          <form action={signOutAction} onSubmit={clearSnapshotCache}>
            <button role="menuitem" className="pressable flex h-10 w-full items-center gap-2.5 rounded-card px-3 text-body text-gray-1000 outline-none hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none">
              <LogOut size={16} strokeWidth={1.5} className="text-gray-900" /> Sign out
            </button>
          </form>
        </div>
      </Popover>
    </>
  );
}
