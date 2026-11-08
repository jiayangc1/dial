"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { fadeFast } from "@/lib/motion";

/**
 * A themed tooltip in place of the browser's `title`. Shows on mouse hover
 * (after a short delay) or keyboard focus, never on touch.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
  align = "center",
  className = "inline-flex",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom";
  align?: "center" | "end";
}) {
  const id = useId();
  const el = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el.current?.getBoundingClientRect();
      if (r) setPos({ x: align === "end" ? r.right : r.left + r.width / 2, y: side === "top" ? r.top - 6 : r.bottom + 6 });
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("pointerdown", hide, true);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("pointerdown", hide, true);
    };
  }, [pos]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <span
        ref={el}
        className={className}
        onPointerEnter={(e) => e.pointerType === "mouse" && show(450)}
        onPointerLeave={hide}
        onFocus={(e) => (e.target as HTMLElement).matches(":focus-visible") && show(0)}
        onBlur={hide}
        aria-describedby={pos ? id : undefined}
      >
        {children}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <m.div
                id={id}
                role="tooltip"
                initial={{ opacity: 0, y: side === "top" ? 2 : -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={fadeFast}
                style={{ left: pos.x, top: pos.y, translate: `${align === "end" ? "-100%" : "-50%"} ${side === "top" ? "-100%" : "0"}` }}
                className="pointer-events-none fixed z-[70] max-w-[260px] whitespace-nowrap rounded-md border border-hairline-strong bg-gray-1000 px-2 py-1 text-label text-bg shadow-lg"
              >
                {content}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
