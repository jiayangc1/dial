import { Suspense } from "react";
import { Mark, Wordmark, SIGNAL } from "@/components/logo";
import { continueWithNotion } from "./actions";
import { ExpiredNotice } from "@/components/expired-notice";
import { SubmitButton } from "@/components/submit-button";

export default function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+24px)] md:justify-center">
      {/* Hero: on phones it fills the top, so the button lands in thumb reach. */}
      <div className="flex flex-1 flex-col items-center justify-center text-center md:flex-none">
        <div className="relative flex size-[208px] items-center justify-center text-gray-1000" aria-hidden="true">
          <DialRing />
          <Mark size={72} />
        </div>
        <h1 className="mt-4 text-gray-1000">
          <span className="sr-only">Dial</span>
          <Wordmark height={36} />
        </h1>
        <p className="mt-3 text-lead text-gray-900">Your classes. Your tasks. Right&nbsp;now.</p>
        <Suspense fallback={null}>
          <ExpiredNotice />
        </Suspense>
      </div>

      <div className="flex w-full max-w-[360px] flex-col items-center md:mt-10">
        <form action={continueWithNotion} className="w-full">
          <SubmitButton className="h-12 w-full rounded-full bg-gray-1000 text-body font-medium text-bg hover:opacity-90">
            Continue with Notion
          </SubmitButton>
        </form>
        <p className="mt-4 max-w-[280px] text-center text-label text-gray-900">
          Dial reads and writes only the pages you share with it. Nothing is stored outside Notion.
        </p>
      </div>
    </main>
  );
}

/** Twelve finger holes around the mark, turning slowly. One is lit: "now". */
function DialRing() {
  const holes = 12;
  return (
    <svg viewBox="-50 -50 100 100" className="dial-ring absolute inset-0 size-full">
      {Array.from({ length: holes }, (_, i) => {
        const a = (i / holes) * Math.PI * 2 - Math.PI / 2;
        const lit = i === 0;
        return (
          <circle
            key={i}
            cx={Math.cos(a) * 44}
            cy={Math.sin(a) * 44}
            r={lit ? 3 : 2.6}
            fill={lit ? SIGNAL : "var(--gray-1000)"}
            opacity={lit ? 1 : 0.1}
          />
        );
      })}
    </svg>
  );
}
