"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  options: string[];
  current: string;
  onPick: (m: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

export function ModeDropdown({ options, current, onPick, open, setOpen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-text hover:bg-surface-muted"
      >
        <span>{current}</span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[240px] rounded-xl border border-border bg-surface p-2 shadow-lg">
          {options.map((opt) => {
            const active = opt === current;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onPick(opt);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[15px] hover:bg-surface-muted"
              >
                <span
                  className={
                    active ? "font-semibold text-teal-bright" : "font-medium text-text"
                  }
                >
                  {opt}
                </span>
                {active && <Check size={14} className="text-teal-bright" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
