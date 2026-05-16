"use client";

import { useEffect, useState } from "react";
import { ResearchShell } from "@/components/research-agent/ResearchShell";
import { LabChat } from "@/components/lab/LabChat";
import { getSelectedPapers, subscribeSelection } from "@/lib/lab/selection";

// /lab/chat — no selected papers → light shell landing with the "Select
// sources" CTA. Selected papers → existing LabChat. Splitting here keeps the
// new visual landing aligned with the screenshot while preserving the
// existing chat-with-papers flow.

export default function ChatWithPapersPage() {
  const [hasSelection, setHasSelection] = useState<boolean | null>(null);

  useEffect(() => {
    const refresh = () => setHasSelection(getSelectedPapers().length > 0);
    refresh();
    return subscribeSelection(refresh);
  }, []);

  // While we haven't checked localStorage yet, render the landing — flicker
  // is preferable to a blank screen on first paint.
  if (hasSelection === null || hasSelection === false) {
    return <ResearchShell mode="chat-papers" />;
  }
  return <LabChat />;
}
