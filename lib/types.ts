// Core domain types. Shape mirrors what Elicit exposes; agent layer will populate these later.

export type PipelineStage = "gather" | "screen" | "extract" | "generate";

export type PipelineStatus = {
  gather: { done: boolean; sourcesFound?: number };
  screen: { done: boolean; sourcesIncluded?: number };
  extract: { done: boolean; dataPointsExtracted?: number };
  generate: { done: boolean };
};

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  citations?: number;
  doi?: string;
  abstract?: string;
  fullTextAvailable: boolean;
  summary?: string; // one-line LLM summary in search results
};

// A user-authored or auto-generated inclusion rule. Papers are screened against
// this criterion; each (paper, criterion) pair gets one ScreeningResult.
export type ScreeningCriterion = {
  id: string;
  text: string;
};

export type ScreeningDecision = "include" | "exclude" | "maybe";

export type ScreeningResult = {
  paperId: string;
  criterionId: string;
  decision: ScreeningDecision;
  rationale: string;
};

export type Screening = {
  criteria: ScreeningCriterion[];
  results: ScreeningResult[];
};

export type ExtractedRow = {
  paperId: string;
  fields: Record<string, string>;
};

// Optional per-cell evidence — short phrases the extractor pulled from the
// abstract that support the cell value. Surfaced as hover popovers in the UI.
export type CellEvidence = {
  quotes: string[];
};

// Free-form report blocks let the UI render a real Elicit-style report.
// Each block is a typed variant.
//
// `cites` accepts either a count (legacy / hand-written fixtures) or an array
// of 1-based paper indices into Report.references. Array form unlocks
// click-through citation popovers; number form falls back to N anonymous marks.
export type Cites = number | number[];

export type ReportBlock =
  | { kind: "paragraph"; text: string; cites?: Cites }
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "sectionLabel"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][]; viewMore?: number }
  | { kind: "notes"; title?: string; items: NotesItem[] };

export type NotesItem = {
  text: string;
  children?: NotesItem[];
};

export type Report = {
  id: string;
  question: string;
  tldr: string;
  date: string; // human-readable
  visibility: "public" | "private";
  // Which corpus this run used. Optional for backwards-compat with fixtures
  // authored before the toggle landed.
  corpus?: "s2" | "core";
  // When the user's query had a typo and we retried gather with a corrected
  // version, store the corrected text here so the UI can surface it. Absent
  // when no correction was attempted or when the original query worked.
  correctedQuery?: string;
  status: PipelineStatus;
  // Which view should we land on first (matches the stage the report is paused at)
  initialView: "report" | "search" | "extraction" | "gather";
  // Method note shown above the report tables
  methods?: string;
  // Ordered report body
  report?: ReportBlock[];
  // Search-style results (used by Search Results view)
  searchResults?: Paper[];
  // Per-paper extraction table (used by Extraction Results view).
  // `evidence` is optional and aligned with `cells` by index; when present,
  // the UI renders a hover popover showing source quotes for each cell.
  extraction?: {
    columns: string[];
    rows: { paper: Paper; cells: string[]; evidence?: CellEvidence[] }[];
  };
  // Sources gathered (used by Gather view)
  gatheredSources?: Paper[];
  // Screening pass results (used by Search Results view to badge each paper)
  screening?: Screening;
  // Full reference list at bottom of report
  references?: Paper[];
};
