import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BookOpen,
  ListChecks,
  Search,
  MessageCircle,
  Scan,
} from "lucide-react";

// Single source of truth for the Elicit-clone sidebar + dropdown items and
// the workflow → mode mapping. Used both by Sidebar.tsx and by
// WorkflowDropdown.tsx so they stay in sync visually.

export type WorkflowKey =
  | "research-agent"
  | "report"
  | "systematic-review"
  | "find-papers"
  | "chat-with-papers"
  | "extract-data";

export type Item = {
  key: WorkflowKey;
  label: string;
  icon: LucideIcon;
  pro?: boolean;
};

export const WORKFLOW_ITEMS: Item[] = [
  { key: "research-agent", label: "Research agent", icon: Atom },
  { key: "report", label: "Report", icon: BookOpen },
  { key: "systematic-review", label: "Systematic review", icon: ListChecks },
];

export const TOOL_ITEMS: Item[] = [
  { key: "find-papers", label: "Find papers", icon: Search },
  { key: "chat-with-papers", label: "Chat with papers", icon: MessageCircle },
  { key: "extract-data", label: "Extract data", icon: Scan },
];

export const ALL_WORKFLOW_ITEMS: Item[] = [...WORKFLOW_ITEMS, ...TOOL_ITEMS];

// Mode options keyed by the workflow they belong to. When the value is null,
// the mode dropdown is hidden entirely (Find papers / Chat with papers /
// Extract data have no modes).
export const MODE_OPTIONS: Record<WorkflowKey, string[] | null> = {
  "research-agent": [
    "General",
    "Competitive landscape",
    "Research landscape",
    "Clinical trial landscape",
  ],
  report: ["Research", "Clinical trials"],
  "systematic-review": ["Research"],
  "find-papers": null,
  "chat-with-papers": null,
  "extract-data": null,
};

export const RECENT_ITEMS = [
  "Biomarkers in Lennox-Gastaut Syndrome Seizures",
  "Sleep Deprivation and Immune Response Markers",
];

export const JUMP_BACK_IN = {
  title: "Biomarkers in Lennox-Gastaut Syndrome Seizures",
  workflow: "Research agent",
  when: "Yesterday",
};

export const SUGGESTED = [
  {
    title: "Cytokine profile changes after 24-hour sleep deprivation",
    workflow: "Research agent",
  },
  {
    title: "Comparative efficacy of biomarkers in Lennox-Gastaut seizure prediction",
    workflow: "Research agent",
  },
];
