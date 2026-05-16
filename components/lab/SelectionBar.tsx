"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSelection, getSelectedPapers, subscribeSelection } from "@/lib/lab/selection";
import { addToLibrary } from "@/lib/library";
import { useToast } from "@/components/ui/Toast";
import { Book, Grid, MessageSquare, X } from "@/components/ui/Icon";

// Sticky action bar shown across all /lab pages when at least one paper is
// selected. ChatGPT-dark surface to match the surrounding chrome.
export function SelectionBar() {
  const { show } = useToast();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(getSelectedPapers().length);
    refresh();
    return subscribeSelection(refresh);
  }, []);

  if (count === 0) return null;

  const saveSelection = () => {
    const papers = getSelectedPapers();
    const added = addToLibrary(papers, "Lab selection");
    if (added > 0) show(`Saved ${added} to library`);
    else show("All selected papers are already in your library");
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-[#2A2A2A] px-6 py-2 text-[13px]">
      <div className="font-medium text-[#ECECEC]">
        {count} paper{count === 1 ? "" : "s"} selected
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/lab/chat"
          className="inline-flex items-center gap-1 rounded-full bg-[#ECECEC] px-3 py-1 text-[12.5px] font-medium text-[#0D0D0D] hover:bg-white"
        >
          <MessageSquare size={11} /> Chat with selection
        </Link>
        <Link
          href="/lab/extract"
          className="inline-flex items-center gap-1 rounded-full bg-[#ECECEC] px-3 py-1 text-[12.5px] font-medium text-[#0D0D0D] hover:bg-white"
        >
          <Grid size={11} /> Extract from selection
        </Link>
        <button
          onClick={saveSelection}
          className="inline-flex items-center gap-1 rounded-full border border-[#3F3F3F] bg-transparent px-2.5 py-1 text-[12.5px] font-medium text-[#ECECEC] hover:border-[#ECECEC]"
          title="Save the current selection to your library"
        >
          <Book size={11} /> Save {count}
        </button>
        <button
          onClick={clearSelection}
          className="inline-flex items-center gap-1 rounded-full bg-transparent px-2.5 py-1 text-[12.5px] text-[#B4B4B4] hover:text-[#ECECEC]"
          title="Clear selection"
        >
          <X size={11} /> Clear
        </button>
      </div>
    </div>
  );
}
