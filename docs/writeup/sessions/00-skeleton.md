# Session 0 — Skeleton

**Date:** 2026-05-11
**Goal:** Clickable UI shell + data contracts + mock API routes, so every later session has a place to plug into.

## What landed

- Next.js 14 (App Router) + TypeScript + Tailwind, custom design tokens (cream/teal, Manrope/Fraunces).
- Root layout + Home page (hero search + 3 example report cards + pipeline-stage overview).
- Report viewer: TopBar + 5-tab nav + StatusSidebar shell at `/report/[id]/...`, wrapping each tab as its own route.
- All 5 tab views: Research report, Extraction results, Search results, Gather sources, Example searches. Each driven by typed fixture data.
- Three fixtures, one per pipeline state: Lennox-Gastaut (complete), CBT depression (mid-search), prostate cancer (mid-gather).
- Mock API routes: `GET /api/reports`, `GET /api/reports/[id]`, `POST /api/reports`, `POST /api/search`. Each returns the fixtures.
- Interactive UI: tab navigation, per-column filter popovers + sort on tables, citation markers, toast notifications.
- Docs scaffolded: `ARCHITECTURE.md`, `DECISIONS.md`, `writeup/00-09` section stubs, this sessions folder.

## What surprised me

- The data contract design (`lib/types.ts`) ended up being the most important file written this session. Once `ReportBlock`, `Paper`, `Report`, and `PipelineStatus` were defined, every component basically wrote itself. Spending time on types before any UI work paid off hugely.
- Reproducing the Elicit table look took fewer custom styles than expected — Tailwind tokens covered ~95% of it. The remaining 5% (the focused active-step highlight in the sidebar) needed absolute positioning tricks.
- The `Cite` marker component is more important than it looks. Every claim in a real research report needs a clickable provenance hover. Putting that primitive in place now means later stages just emit citation IDs, not new UI.

## What I'd do differently

- Should have decided on the `ReportBlock` union shape *before* writing the Lennox-Gastaut fixture. I refactored the fixture twice because the type evolved.
- The DataTable component conflates "report-narrative table" and "extraction table" responsibilities a bit. May need to split when extraction gains its own behaviors (cell-level cites, edit-in-place, etc.).

## Open questions

- Once the agent layer emits real `ReportBlock[]`, will my types be strict enough? E.g., are 3 levels of headings enough? Will LLMs want to emit footnotes, callouts, equations?
- The sidebar status panel is currently driven by a discriminated record per stage. When stages stream progress (Session 5), I need to add an `inProgress: { fractionComplete: number }` variant.
- Caching: the in-memory `reports` registry in `lib/data/reports.ts` becomes a database the moment Session 1 starts. Worth keeping the shape (id → Report) so the swap is small.
