"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { MotionRoot } from "./motion-root";
import { Check, TriangleAlert, ArrowRight, FileText } from "lucide-react";
import { Mark } from "./logo";
import { Spinner } from "./spinner";
import { connectTracker } from "@/app/actions";
import { schedules, timezone } from "@/config/bells";
import { accentStyle } from "@/lib/colors";
import { scheduleMismatches } from "@/lib/schedule";
import type { Course, Snapshot } from "@/lib/types";
import { spring, fade } from "@/lib/motion";

type SharedPage = { id: string; title: string; icon: string | null };
type PagesResponse = { pages: SharedPage[]; detected: string | null; found: boolean };

const STEPS = ["Connect Notion", "Pick your tracker", "Confirm bell schedule"];

export function Onboarding() {
  const [step, setStep] = useState(1); // step 0 (connect) is done by the time you're here
  const [dir, setDir] = useState(1);
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  return (
    <MotionRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-[calc(var(--safe-bottom)+16px)] pt-[calc(var(--safe-top)+16px)] md:justify-center md:py-16">
        <header className="flex h-14 items-center justify-between md:mb-8">
          <Mark size={24} className="text-gray-1000" />
          <StepDots step={step} />
        </header>

        <div className="relative flex flex-1 flex-col md:flex-none">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <m.section
              key={step}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 16 * d }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: -16 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: spring.ui, opacity: fade }}
              className="flex flex-1 flex-col pt-8"
              aria-labelledby={`step-${step}`}
            >
              <p className="text-label uppercase tracking-[0.04em] text-gray-900">
                Step {step + 1} of 3 · {STEPS[step]}
              </p>
              {step === 1 && <PickTracker onDone={() => go(2)} />}
              {step === 2 && <ConfirmBells onBack={() => go(1)} />}
            </m.section>
          </AnimatePresence>
        </div>
      </main>
    </MotionRoot>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
      {STEPS.map((label, i) => (
        <li key={label} aria-current={i === step ? "step" : undefined} className="flex items-center">
          <m.span
            className="block h-1.5 rounded-full bg-gray-1000"
            initial={false}
            animate={{ width: i === step ? 20 : 6, opacity: i <= step ? 1 : 0.2 }}
            transition={spring.ui}
          />
          <span className="sr-only">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function PickTracker({ onDone }: { onDone: () => void }) {
  const [data, setData] = useState<PagesResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    fetch("/api/onboarding")
      .then(async (r) => {
        if (r.status === 401) return window.location.replace("/auth/expired");
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Couldn't reach Notion.");
        const body = (await r.json()) as PagesResponse;
        if (!live) return;
        setData(body);
        setSelected(body.detected);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const submit = () => {
    if (!selected) return;
    setError(null);
    start(async () => {
      const res = await connectTracker(selected);
      if (res.ok) onDone();
      else if (res.reauth) window.location.replace("/auth/expired");
      else setError(res.message);
    });
  };

  return (
    <>
      <h1 id="step-1" className="mt-3 text-title font-semibold tracking-[-0.02em] text-gray-1000">
        Where do your assignments live?
      </h1>
      <p className="mt-3 text-body text-gray-900">
        Pick the page you shared on Notion&rsquo;s consent screen. Dial finds the Assignments and Courses databases inside it.
      </p>

      <div className="mt-8">
        {!data && !error && <PageListSkeleton />}
        {data && data.pages.length === 0 && (
          <div className="surface rounded-card p-4 text-body text-gray-900">
            No pages were shared with Dial. Sign out and share your 🎒 Assignment Tracker page on the consent screen.
          </div>
        )}
        {data && data.pages.length > 0 && (
          <div role="radiogroup" aria-label="Tracker page" className="surface overflow-hidden rounded-card">
            {data.pages.map((p, i) => {
              const on = selected === p.id;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(p.id)}
                  className={`pressable flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-gray-100 ${i ? "border-t border-hairline" : ""}`}
                >
                  <span className="flex size-5 items-center justify-center text-[16px] leading-none" aria-hidden="true">
                    {p.icon ?? <FileText size={16} strokeWidth={1.5} className="text-gray-900" />}
                  </span>
                  <span className="flex-1 truncate text-body text-gray-1000">{p.title}</span>
                  {p.id === data.detected && <span className="text-label text-gray-900">Detected</span>}
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${on ? "border-gray-1000 bg-gray-1000" : "border-gray-500"}`}
                    style={{ transition: "background-color 150ms var(--ease-out), border-color 150ms var(--ease-out)" }}
                  >
                    <AnimatePresence>
                      {on && (
                        <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.ui}>
                          <Check size={12} strokeWidth={2.5} className="text-bg" />
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <ErrorLine message={error} />
      </div>

      <div className="mt-auto pt-8 md:mt-0">
        <button
          onClick={submit}
          disabled={!selected || pending}
          className="pressable relative flex h-12 w-full items-center justify-center rounded-full bg-gray-1000 text-body font-medium text-bg disabled:opacity-40"
        >
          {pending ? <Spinner /> : "Use this page"}
        </button>
      </div>
    </>
  );
}

/** "13:40" → "1:40". School hours are unambiguous without AM/PM. */
function clock(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}

function ConfirmBells({ onBack }: { onBack: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  useEffect(() => {
    fetch("/api/data")
      .then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : null))
      .then((s) => s && setCourses(s.courses))
      .catch(() => {});
  }, []);

  const byName = new Map(courses?.map((c) => [c.name, c]));
  const mismatch = courses ? scheduleMismatches(courses) : null;
  const regular = schedules.regular;

  return (
    <>
      <h1 id="step-2" className="mt-3 text-title font-semibold tracking-[-0.02em] text-gray-1000">
        Is this your day?
      </h1>
      <p className="mt-3 text-body text-gray-900">
        From <code className="font-mono text-small text-gray-1000">config/bells.ts</code>, in {timezone.replace("_", " ")}. Edit that file to change it.
      </p>

      <ol className="surface mt-8 overflow-hidden rounded-card">
        {regular.map((p, i) => {
          const c = p.course ? byName.get(p.course) : null;
          const missing = !!courses && !!p.course && !c;
          return (
            <li
              key={p.period}
              className={`flex min-h-12 items-center gap-3 px-4 ${i ? "border-t border-hairline" : ""}`}
              style={accentStyle(c?.color)}
            >
              <span className="w-10 font-mono text-small tabular text-gray-900">{p.period.length <= 2 ? `P${p.period}` : ""}</span>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: p.course ? "var(--accent)" : "transparent", border: p.course ? "none" : "1px solid var(--gray-500)" }}
              />
              <span className={`flex-1 truncate text-body ${p.course ? "text-gray-1000" : "text-gray-900"}`}>{p.course ?? p.period}</span>
              {missing && (
                <span className="flex items-center gap-1 text-label text-red" title="No enrolled Notion course has this exact name">
                  <TriangleAlert size={12} strokeWidth={1.5} /> Not in Notion
                </span>
              )}
              <span className="font-mono text-small tabular text-gray-900">
                {clock(p.start)}–{clock(p.end)}
              </span>
            </li>
          );
        })}
      </ol>

      {mismatch && mismatch.unscheduled.length > 0 && (
        <p className="mt-3 text-small text-gray-900">
          Not on the schedule: {mismatch.unscheduled.join(", ")}. They&rsquo;ll still be on the wheel.
        </p>
      )}

      <div className="mt-auto flex gap-3 pt-8 md:mt-0">
        <button onClick={onBack} className="pressable h-12 rounded-full px-5 text-body text-gray-900 hover:bg-gray-100 hover:text-gray-1000">
          Back
        </button>
        <a
          href="/app"
          className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gray-1000 text-body font-medium text-bg"
        >
          Looks right · Open Dial <ArrowRight size={16} strokeWidth={1.5} />
        </a>
      </div>
    </>
  );
}

function PageListSkeleton() {
  return (
    <div className="surface overflow-hidden rounded-card" aria-busy="true" aria-label="Loading pages">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`flex h-14 items-center gap-3 px-4 ${i ? "border-t border-hairline" : ""}`}>
          <div className="skeleton size-5" />
          <div className="skeleton h-3.5" style={{ width: `${[52, 36, 44][i]}%` }} />
        </div>
      ))}
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <m.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="mt-3 flex items-start gap-2 text-small text-red"
        >
          <TriangleAlert size={16} strokeWidth={1.5} className="mt-px shrink-0" />
          {message}
        </m.p>
      )}
    </AnimatePresence>
  );
}
