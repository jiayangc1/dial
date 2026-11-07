"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./spinner";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`pressable relative inline-flex items-center justify-center ${className}`}>
      <span className={pending ? "opacity-0" : "opacity-100"} style={{ transition: "opacity 150ms var(--ease-out)" }}>
        {children}
      </span>
      {pending && <Spinner className="absolute" />}
    </button>
  );
}
