"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { spring } from "@/lib/motion";

type Align = "start" | "end";

/**
 * A floating panel anchored to a trigger. Portalled to <body> so it escapes
 * the sheet's overflow and transforms, flips above the trigger when there's
 * no room below, and closes on outside press or Escape (without letting the
 * Escape reach the sheet underneath).
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "start",
  width,
  label,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  align?: Align;
  /** px, or "anchor" to match the trigger's width */
  width?: number | "anchor";
  label?: string;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setPos(measure(anchor.current, panel.current, width, align));
    place();
    // A second pass once the panel has its real height.
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width, align]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
      anchor.current?.focus({ preventScroll: true });
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    // Window capture runs before the sheet's document-level Escape handler.
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchor]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          ref={panel}
          role="dialog"
          aria-label={label}
          initial={{ opacity: 0, scale: 0.97, y: pos?.up ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={spring.ui}
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            width: pos?.width,
            transformOrigin: `${pos?.up ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
            visibility: pos ? "visible" : "hidden",
          }}
          className={`menu-surface fixed z-[60] overflow-hidden rounded-sheet ${className}`}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type Pos = { top: number; left: number; width?: number; up: boolean };

/** Below the trigger, or above it when there's no room; kept 8px inside the viewport. */
function measure(a: HTMLElement | null, panel: HTMLElement | null, width: number | "anchor" | undefined, align: Align): Pos | null {
  if (!a) return null;
  const r = a.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = width === "anchor" ? r.width : (width ?? panel?.offsetWidth ?? 280);
  const h = panel?.offsetHeight ?? 320;
  const gap = 6;
  const up = r.bottom + gap + h > vh - 8 && r.top - gap - h > 8;
  const left = Math.min(Math.max(8, align === "end" ? r.right - w : r.left), vw - w - 8);
  return { top: up ? r.top - gap - h : r.bottom + gap, left, width: width === "anchor" ? r.width : width, up };
}
