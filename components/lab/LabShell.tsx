"use client";

import { Sidebar, TopBar, type Mode } from "@/components/research-agent/ResearchShell";

// Wraps a Lab tool in the same shell the rest of Evoke uses (sidebar + top
// bar), so /lab/* pages match /research-agent instead of floating bare.
export function LabShell({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen bg-white text-[#1F2937] dark:bg-[#0F0F0F] dark:text-[#ECECEC]"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <Sidebar mode={mode} />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="mx-auto flex w-full max-w-[1100px] flex-col items-stretch px-6 pt-10 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}
