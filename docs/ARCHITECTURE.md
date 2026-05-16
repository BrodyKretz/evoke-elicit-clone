# Evoke — Architecture

> Living document. Updated as the system grows from skeleton → agent layer → production-grade.

## What Evoke is

A reverse-engineered, open-source clone of [Elicit](https://elicit.com) — a research tool that:

1. Takes a natural-language research question.
2. Semantically ranks papers in a corpus by similarity to the question (plus citation count + recency).
3. Narrows the top ~1,000 results using LLM-based screening criteria.
4. Extracts structured data fields from each remaining paper.
5. Synthesizes the extracted data into a narrative research report with inline citations.

The goal of *this* repository is to build the same product, but with the agent layer, prompts, and retrieval pipeline open and inspectable.

## Pipeline stages

```
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
   │ Gather  │───▶│ Screen  │───▶│ Extract │───▶│ Generate │
   └─────────┘    └─────────┘    └─────────┘    └──────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
  semantic search   LLM yes/no    structured     narrative
  + citation/age    against each  fields per     synthesis +
  re-ranking        criterion     paper          tables + cites
```

Each stage is a clean boundary. The UI surfaces the output of each stage in its own tab (Gather sources / Search results / Extraction results / Research report), and a sidebar tracks which stage the current report is in.

## Current state (skeleton)

What's in place:

- **Next.js 14 (App Router) + TypeScript + Tailwind** UI shell.
- Full 5-tab report viewer (Research report / Extraction / Search / Gather / Examples).
- Status sidebar reflecting pipeline progress per-report.
- Three baked-in fixtures, one per pipeline state (complete / mid-search / mid-gather).
- Mock API routes at `/api/reports`, `/api/reports/[id]`, `/api/search` returning the fixtures.
- All interactive UI working: tab nav, sort/filter on tables, citation hovers, toasts.

What's *not* yet built (intentionally — phase 2):

- Real semantic search over a paper corpus.
- LLM agents for screening / extraction / synthesis.
- Authentication & persistence (currently fixtures live in TypeScript).
- Streaming progress updates.
- The "Chat with this report" sidebar interaction.

## Directory layout

```
app/                     Next.js App Router
  page.tsx                 Home (hero + example cards)
  report/[id]/             Report viewer with 5 tabs
    layout.tsx               TopBar + Tabs + StatusSidebar shell
    {report,extraction,search,gather,examples}/page.tsx
  api/
    reports/route.ts         GET list / POST new
    reports/[id]/route.ts    GET one
    search/route.ts          POST query → results
components/
  layout/                  TopBar, Tabs, StatusSidebar
  ui/                      Icons, Toast, Cite marker
  report/                  ReportView, DataTable, NotesBlock
  search/                  SearchView
  extraction/              ExtractionView
  gather/                  GatherView
  examples/                ExamplesView
  home/                    Hero, ExampleReportCard
lib/
  types.ts                 Domain types (Report, Paper, PipelineStatus…)
  data/
    reports.ts             In-memory registry (will become a DB)
    fixtures/              Three seeded reports
  utils/cn.ts              Tailwind class merger
docs/
  ARCHITECTURE.md          This file
  DECISIONS.md             Running ADR log
  writeup/                 Section drafts for the post-mortem blog post
```

## Data model

The single load-bearing type is `Report`:

```ts
type Report = {
  id: string;
  question: string;       // the research question
  tldr: string;           // 1-sentence answer
  status: PipelineStatus; // which stages have run
  initialView: ...;       // which tab the UI lands on first
  report?: ReportBlock[]; // narrative + tables (Generate output)
  extraction?: ...;       // per-paper structured fields (Extract output)
  searchResults?: ...;    // ranked papers w/ summaries (Gather output post-rank)
  gatheredSources?: ...;  // raw retrieval results (Gather output pre-rank)
  references?: Paper[];
};
```

Three reports are seeded to demonstrate each pipeline state:

| ID | Question | Stage shown |
| --- | --- | --- |
| `lennox-gastaut` | Which biomarkers are most commonly used for seizures associated with Lennox-Gastaut syndrome? | Complete — full report |
| `cbt-depression` | How effective is online vs. face-to-face CBT for depression? | Mid-pipeline — search results |
| `prostate-cancer` | What are the most effective molecular targets for treatment of metastatic neuroendocrine prostate cancer in patients who have failed standard androgen deprivation therapy? | Early — gathering sources |

## How the agent layer will plug in (phase 2)

The skeleton was designed so swapping mock → real is mechanical:

1. **`/api/search` → real retrieval.** Replace mock return with an embedding-based ranker (e.g., bge-large + reciprocal-rank-fused citation/recency boost) over a paper corpus (Semantic Scholar API or OpenAlex dump).
2. **`/api/reports` POST → real pipeline run.** Spawns a background pipeline (Python service, called over HTTP). Streams progress events back via SSE.
3. **Per-stage agents.** Screening agent (yes/no + rationale per criterion), extraction agent (per-paper field LLM call), synthesis agent (table-aware narrative generation).
4. **Persistence.** SQLite for run metadata, S3-compatible blob for paper PDFs, Postgres + pgvector for embeddings.

The TS types in `lib/types.ts` are the contract — every agent output must conform.

## Open questions

- Should screening criteria be authored by the user or auto-suggested from the research question? Elicit does both.
- How do we handle papers behind paywalls? Elicit silently downgrades to "abstract only."
- What's the cost ceiling per report at the 1,000-paper scale? Need a back-of-envelope on tokens × model.
- Streaming vs. batch UX for long-running runs? Likely streaming progress + final render.
