"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { ProBadge } from "./ProBadge";
import {
  TOOL_ITEMS,
  WORKFLOW_ITEMS,
  type Item,
  type WorkflowKey,
} from "@/lib/elicit-clone/constants";

type Props = {
  current: WorkflowKey;
  onPick: (key: WorkflowKey) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

function PanelItem({
  item,
  active,
  onClick,
}: {
  item: Item;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-[#F3F4F6]"
    >
      <Icon
        size={18}
        className={active ? "text-[#1F6E68]" : "text-[#1F2937]"}
      />
      <span
        className={`flex-1 truncate ${
          active ? "font-semibold text-[#1F6E68]" : "font-medium text-[#1F2937]"
        }`}
      >
        {item.label}
      </span>
      {item.pro && <ProBadge />}
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
      {label}
    </div>
  );
}

export function WorkflowDropdown({ current, onPick, open, setOpen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const currentItem = [...WORKFLOW_ITEMS, ...TOOL_ITEMS].find((i) => i.key === current);
  const CurIcon = currentItem?.icon;

  // Close on outside click or Escape.
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
        className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6]"
      >
        {CurIcon && <CurIcon size={14} className="text-[#1F2937]" />}
        <span>{currentItem?.label ?? "Research agent"}</span>
        <ChevronDown size={14} className="text-[#6B7280]" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[280px] rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-lg">
          <SectionHeader label="Workflows" />
          {WORKFLOW_ITEMS.map((it) => (
            <PanelItem
              key={it.key}
              item={it}
              active={it.key === current}
              onClick={() => {
                onPick(it.key);
                setOpen(false);
              }}
            />
          ))}
          <SectionHeader label="Tools" />
          {TOOL_ITEMS.map((it) => (
            <PanelItem
              key={it.key}
              item={it}
              active={it.key === current}
              onClick={() => {
                onPick(it.key);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
