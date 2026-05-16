"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { key: "report", label: "Research report" },
  { key: "extraction", label: "Extraction results" },
  { key: "search", label: "Search results" },
  { key: "gather", label: "Gather sources" },
] as const;

export function Tabs({ reportId }: { reportId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border bg-bg px-6">
      {TABS.map((t) => {
        const href = `/report/${reportId}/${t.key}`;
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3.5 py-3 text-[13px] font-medium transition-colors",
              active ? "border-teal text-teal" : "text-text-muted hover:text-text"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
