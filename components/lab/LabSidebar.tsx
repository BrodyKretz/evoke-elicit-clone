"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Book,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Grid,
  MessageSquare,
  Search,
  Sparkles,
} from "@/components/ui/Icon";
import { getLibrary, subscribeLibrary } from "@/lib/library";
import { cn } from "@/lib/utils/cn";

type Item = {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  badge?: string;
};

const WORKFLOWS: Item[] = [
  { href: "/research-agent", label: "Research agent", icon: Sparkles },
  { href: "/lab/report", label: "Report", icon: FileText },
  { href: "/lab/review", label: "Systematic review", icon: Filter },
  { href: "/lab/notebook", label: "Notebook", icon: Book },
];

const TOOLS: Item[] = [
  { href: "/lab/find", label: "Find papers", icon: Search },
  { href: "/lab/import", label: "Import papers", icon: Download },
  { href: "/lab/chat", label: "Chat with papers", icon: MessageSquare },
  { href: "/lab/extract", label: "Extract data", icon: Grid },
  { href: "/lab/trials", label: "Search clinical trials", icon: ExternalLink },
];

function Section({ title, items, pathname }: { title: string; items: Item[]; pathname: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-[#8E8E8E]">
        {title}
      </div>
      <ul className="flex flex-col">
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "mx-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition-colors",
                  active
                    ? "bg-[#2F2F2F] text-[#ECECEC]"
                    : "text-[#ECECEC] hover:bg-[#2A2A2A]"
                )}
              >
                <Icon size={15} className="text-[#ECECEC]" />
                <span className="flex-1 truncate">{it.label}</span>
                {it.badge && (
                  <span className="rounded-md bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E]">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LabSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex h-screen w-[260px] flex-shrink-0 flex-col bg-[#171717] text-[#ECECEC]">
      <div className="flex items-center justify-between px-4 py-3.5">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#ECECEC]">
          Evoke
        </Link>
        <span className="rounded-md bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#B4B4B4]">
          Lab
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-1 py-2">
        <Section title="Workflows" items={WORKFLOWS} pathname={pathname} />
        <Section title="Tools" items={TOOLS} pathname={pathname} />
        <LibraryRow pathname={pathname} />
      </nav>

      <div className="px-3 py-3 text-[11.5px] leading-relaxed text-[#8E8E8E]">
        Standalone tools that share Evoke&apos;s agent stack. Pick papers,
        then chat or extract without committing to a full report.
      </div>
    </aside>
  );
}

// Library is special-cased: it's a saved-papers store rather than a tool, and
// renders a live count badge that subscribes to the library store so saves
// from any /lab surface light it up.
function LibraryRow({ pathname }: { pathname: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(getLibrary().length);
    refresh();
    return subscribeLibrary(refresh);
  }, []);
  const active = pathname === "/library";
  return (
    <div className="mb-3 mt-1 border-t border-[#2A2A2A] pt-3">
      <Link
        href="/library"
        className={cn(
          "mx-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition-colors",
          active ? "bg-[#2F2F2F] text-[#ECECEC]" : "text-[#ECECEC] hover:bg-[#2A2A2A]"
        )}
      >
        <Book size={15} className="text-[#ECECEC]" />
        <span className="flex-1 truncate">Library</span>
        {count > 0 && (
          <span className="rounded-full bg-[#1F6E68] px-1.5 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}
