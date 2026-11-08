"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { spring } from "@/lib/motion";

export type Toast = {
  id: string;
  message: string;
  tone?: "default" | "error";
  action?: { label: string; run: () => void };
  /** ms; default 5000 */
  duration?: number;
};

type Ctx = { push: (t: Omit<Toast, "id">) => string; dismiss: (id: string) => void };
const ToastCtx = createContext<Ctx>({ push: () => "", dismiss: () => {} });
export const useToasts = () => useContext(ToastCtx);

export function ToastProvider({ children, bottomOffset }: { children: React.ReactNode; bottomOffset: number }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    return id;
  }, []);

  return (
    <ToastCtx value={{ push, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ bottom: `calc(var(--safe-bottom) + ${bottomOffset}px)` }}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastView key={t.id} toast={t} onDone={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const duration = toast.duration ?? 5000;
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const started = useRef(0);

  useEffect(() => {
    if (paused) return;
    started.current = performance.now();
    const id = setTimeout(onDone, remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current -= performance.now() - started.current;
    };
  }, [paused, onDone]);

  return (
    <m.div
      layout
      role={toast.tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={spring.ui}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500) onDone();
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="glass pointer-events-auto relative w-full max-w-[400px] cursor-grab overflow-hidden rounded-sheet border border-hairline-strong active:cursor-grabbing"
    >
      <div className="flex min-h-12 items-center gap-3 py-2 pl-4 pr-2">
        {toast.tone === "error" && <TriangleAlert size={16} strokeWidth={1.5} className="shrink-0 text-red" />}
        <p className="min-w-0 flex-1 text-body text-gray-1000">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.run();
              onDone();
            }}
            className="pressable h-9 shrink-0 rounded-full px-3 text-body font-medium text-gray-1000 hover:bg-gray-100"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {/* Countdown bar */}
      <m.div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gray-1000/30"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: paused ? undefined : 0 }}
        transition={{ duration: reduced ? 0 : duration / 1000, ease: [0.4, 0, 0.6, 1] }}
      />
    </m.div>
  );
}
