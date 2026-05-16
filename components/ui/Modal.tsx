"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "@/components/ui/Icon";

// Lightweight centered modal: backdrop click + Esc close, scroll lock on body
// while open. Use for transient detail panels — methods, citation formats,
// criteria detail. Anything heavier should be a route.
export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${widthClass} max-h-full overflow-y-auto rounded-xl bg-surface text-text shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
