"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { spring, fade } from "@/lib/motion";

/**
 * Bottom sheet: springs up, has a drag handle, dismisses on a downward drag
 * or flick. The app behind it scales to 0.96 and dims (done by the parent
 * via `onOpenChange`). On desktop it's a centred panel.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  style,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  initialFocus?: string;
}) {
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        // Keep focus inside the sheet.
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => {
      const el = initialFocus ? panel.current?.querySelector<HTMLElement>(initialFocus) : panel.current;
      el?.focus({ preventScroll: true });
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
      restore.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, initialFocus]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" style={style}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { ...spring.ui, stiffness: 500 } }}
            transition={spring.ui}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="glass relative max-h-[92dvh] w-full overflow-hidden rounded-t-sheet border border-b-0 border-hairline-strong outline-none md:mb-0 md:max-w-[520px] md:rounded-sheet md:border-b"
          >
            <div
              className="flex h-6 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
              aria-hidden="true"
            >
              <span className="h-1 w-9 rounded-full bg-gray-500" />
            </div>
            <div className="max-h-[calc(92dvh-24px)] overflow-y-auto overscroll-contain px-4 pb-[calc(var(--safe-bottom)+16px)] md:px-6 md:pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
