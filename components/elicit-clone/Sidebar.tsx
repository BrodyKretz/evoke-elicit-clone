"use client";

import { Atom, ChevronDown, Layers } from "lucide-react";
import { ProBadge } from "./ProBadge";
import {
  RECENT_ITEMS,
  TOOL_ITEMS,
  WORKFLOW_ITEMS,
  type Item,
} from "@/lib/elicit-clone/constants";

function SectionHeader({ label, withChevron = false }: { label: string; withChevron?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </span>
      {withChevron && <ChevronDown size={14} className="text-[#9CA3AF]" />}
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] font-medium text-[#1F2937] hover:bg-[#F3F4F6]"
    >
      <Icon size={18} className="flex-shrink-0 text-[#1F2937]" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.pro && <ProBadge />}
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-[#E5E7EB] bg-[#FAFAF9] px-4 py-5">
      <div className="flex items-center gap-2 pb-5">
        <Layers size={22} className="text-[#1F6E68]" />
        <span className="text-xl font-semibold text-[#1F6E68]">Elicit</span>
      </div>
      <div className="border-b border-[#E5E7EB]" />

      <div className="mt-6">
        <SectionHeader label="Workflows" withChevron />
        <div className="flex flex-col">
          {WORKFLOW_ITEMS.map((it) => (
            <ItemRow key={it.key} item={it} />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader label="Tools" withChevron />
        <div className="flex flex-col">
          {TOOL_ITEMS.map((it) => (
            <ItemRow key={it.key} item={it} />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-[#E5E7EB] pt-5">
        <SectionHeader label="Recents" />
        <div className="flex flex-col">
          {RECENT_ITEMS.map((title) => (
            <button
              key={title}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#F3F4F6]"
            >
              <Atom size={16} className="flex-shrink-0 text-[#1F2937]" />
              <span className="truncate text-[15px] font-medium text-[#1F2937]">{title}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
