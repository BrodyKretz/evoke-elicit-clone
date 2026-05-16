# Lab Tools: Unlock, UI Parity, and Elicit-Aligned Behavior

**Date:** 2026-05-16
**Status:** Approved, ready for implementation plan

## Problem

The "Systematic Review" (`/lab/review`) and "Extract Data" (`/lab/extract`) tools:

1. Show a cosmetic "PRO" lock badge in the elicit-clone UI surface.
2. Use a dark, hardcoded hex palette disconnected from the rest of Evoke's
   warm-paper light theme (semantic Tailwind tokens).
3. Functionally work (real LLM calls) but have not been independently verified
   end-to-end via their standalone Lab endpoints.
4. Diverge from how Elicit describes these features (Extract: custom **or**
   AI-generated columns → CSV table; Review: editable criteria).

## Goals

- **A. Unlock:** remove the cosmetic PRO gate on both tools.
- **B. UI parity:** convert `ReviewSearch.tsx` and `LabExtract.tsx` (and the Lab
  chrome they render within — `LabSidebar.tsx`, `LabTopBar.tsx`) from hardcoded
  dark hex to the existing semantic light tokens so they match the rest of Evoke.
- **C. Verify:** independently live-test `/api/lab/review` and `/api/lab/extract`
  with real requests and confirm correct, well-formed output.
- **D. Elicit-aligned behavior (scoped):**
  - *Extract Data:* user-editable / custom columns (add / rename / remove,
    AI still suggests the initial set) + CSV export.
  - *Systematic Review:* multi-criterion screening (schema already an array;
    UI/agent currently use `[0]` only).

## Explicitly out of scope (deferred, too large)

Fulltext screening, bring-your-own-PDF upload, XLSX export, the app-wide dark
theme, `CORE_API_KEY` rotation, the extraction/synthesis speed pass.

## Design

### A. Unlock (trivial)

`lib/elicit-clone/constants.ts`:
- Line ~33: remove `pro: true` from the `systematic-review` workflow item.
- Line ~39: remove `pro: true` from the `extract-data` tool item.

No other change; `ProBadge` simply stops rendering for these two. The actual
Lab routes were never API-gated.

### B. UI parity

Token reference (`tailwind.config.ts`): `bg`, `surface`, `surface-muted`,
`border`, `border-strong`, `teal{DEFAULT,hover,light}`,
`text{DEFAULT,muted,faint}`, `chip{bg,border}`.

Replace hardcoded hex in `ReviewSearch.tsx`, `LabExtract.tsx`,
`LabSidebar.tsx`, `LabTopBar.tsx` with the semantic equivalents:

- Dark backgrounds (`#0D0D0D`, `#202020`, `#2A2A2A`, `#2F2F2F`) → `bg-bg` /
  `bg-surface` / `bg-surface-muted`.
- Light text (`#ECECEC`) → `text-text`; medium (`#B4B4B4`, `#8E8E8E`) →
  `text-text-muted` / `text-text-faint`.
- Borders (`#3F3F3F`, etc.) → `border-border` / `border-border-strong`.
- Accent (`#1F6E68`) → `teal`.
- Screening decision colors are **semantic, keep distinct hues** but
  re-tuned to read on the light theme. Define them once and reuse:
  - include → green family, maybe → amber family, exclude → red/rose family.
  - Centralize in a small shared map (e.g. `lib/lab/decision-styles.ts`)
    consumed by both `ReviewSearch` and any other decision-badge UI, so the
    two tools stay visually consistent.

Match existing app patterns (the `.btn`, `.section-label`, etc. component
classes in `globals.css`) where they fit rather than re-styling from scratch.

### C. Verification (mandatory, done by implementer)

For every change, run the live dev server and exercise the real endpoint:

- `POST /api/lab/review` with a real query (e.g. CBT/depression) → assert
  papers returned, each with a `decision` ∈ {include,maybe,exclude} and a
  non-empty rationale; criterion echoed back.
- `POST /api/lab/extract` with a real paper set + question → assert columns,
  one row per paper, cells aligned to columns, evidence quotes present.
- Multi-criterion: `POST /api/lab/review` with ≥2 criteria → assert each paper
  carries a per-criterion decision and the aggregate decision is correct.
- Custom columns: `POST /api/lab/extract` with explicit `columns` → assert the
  table uses exactly those columns, in order.
- CSV export: assert the generated CSV parses, has a header row matching the
  columns + paper metadata, and one row per paper with proper escaping.
- UI: load `/lab/review` and `/lab/extract` in a real browser
  (Playwright/screenshot), confirm they visually match the light theme and
  have no leftover dark panels; confirm editable-column controls work.

A change is "done" only when its verification command was run and the output
inspected. "Wrote the code" ≠ "works."

### D1. Editable / custom extraction columns

`lib/agents/extract.ts`:
- Remove `COLUMN_COUNT = 4`; add `MIN_COLUMNS = 1`, `MAX_COLUMNS = 8`.
- `generateColumns(question)` → flexible suggested set (3–6), used only as the
  default when the caller supplies none. Relax tool schema min/maxItems and the
  system prompt accordingly; keep the defensive "≥1 usable column" guard.
- Add `sanitizeColumns(input): string[]` — trim, drop empties, dedupe
  (case-insensitive), clamp to `[MIN,MAX]`. Single source of truth.
- `extractPapers(papers, question, opts)` where
  `opts = { columns?, concurrency?, onEvent? }`. If `columns` provided &
  non-empty → `sanitizeColumns` then use verbatim, skip generation; else
  generate. Emit the `columns` event either way. Per-paper schema already keys
  off `columns.length`; no further change.

`app/api/lab/extract/route.ts`: accept optional `columns?: string[]`,
sanitize, pass through. Response shape unchanged (already returns `columns`).

Main report cascade: new `POST /api/reports/[id]/re-extract` mirroring the
existing `rescreen` route — body `{ columns }`, reject fixtures, reset
`extract`+`generate` status, run `extract(columns) → synthesize` reusing
screened papers, stream via the existing SSE bus + persist via store. New
pipeline entry `runFromExtraction(...)` analogous to `runFromScreening(...)`
(synthetic stage.done for gather/screen, then extract→synthesize).

CSV export: a pure helper `extractionToCsv(columns, rows)` (RFC-4180 escaping;
header = paper title/authors/year + columns; one row per paper). Wire a
"Download CSV" button in `LabExtract` and the report extraction view.

UI (`LabExtract.tsx` + `components/extraction/ExtractionView.tsx`): columns
become editable — inline rename, remove (×), "Add column" input. AI still
auto-suggests the initial set. "Re-run extraction" enabled only when changed,
disabled at 0 columns, capped at `MAX_COLUMNS`. Re-run = full re-extract of
all included papers (simple + correct; incremental deferred). Show
"re-extracts N papers" so cost is visible. Lab → re-POST `/api/lab/extract`;
report → POST `/re-extract` then re-subscribe to the stream.

### D2. Multi-criterion screening

`lib/agents/screen.ts`:
- `screenPaper(paper, criteria: string[], question)` → evaluate each criterion;
  return per-criterion decisions plus an aggregate (a paper is `include` only
  if it satisfies all inclusion criteria; `exclude` if it fails any; else
  `maybe`). Keep forced-tool-use for reliable JSON.
- `generateCriterion(question)` may still propose a single starter criterion;
  callers may pass an array.
- Update `ScreeningResult` / types to carry `perCriterion` results without
  breaking existing single-criterion consumers (single criterion = array of 1).

`app/api/lab/review/route.ts`: accept `criteria?: string[]` (back-compat:
accept the existing single `criterion` and wrap to `[criterion]`).

`ReviewSearch.tsx`: criterion editor becomes a list — add / edit / remove
criteria; show per-criterion pass/fail per paper alongside the aggregate badge.

Pipeline `rescreen` path: extend to pass the criteria array through; existing
single-criterion behavior preserved as the n=1 case.

## Data / type changes

- `Report.extraction.columns` already `string[]` — no schema change; persisted
  edited columns survive reload via the existing store.
- Screening types gain `perCriterion: { criterion: string; decision; rationale }[]`
  with the aggregate `decision` retained for back-compat. Migrate read sites
  defensively (treat missing `perCriterion` as `[{criterion, decision,
  rationale}]`).

## Testing

Match existing `tests/` style (Node test runner via `node --import tsx
--test`, **not pytest** — TS project).

- Unit: `sanitizeColumns` (trim/dedupe/clamp/empty), `extractPapers` honors
  passed columns (mock Anthropic), multi-criterion aggregation logic
  (include/exclude/maybe truth table), `extractionToCsv` escaping.
- Integration (live, real Claude — implementer runs these): the verification
  matrix in section C, via an extended `scripts/feature-test.sh`.
- UI: Playwright load of `/lab/review` and `/lab/extract` — screenshot for
  theme parity, interact with column editor + criteria list.

## Risks / decisions

- Re-extract cost: full re-extract per column edit (~$0.017/paper). Accepted
  for v1; UI surfaces the paper count. Incremental deferred.
- Multi-criterion increases screening cost roughly linearly with criterion
  count (one Haiku evaluation per criterion per paper); acceptable, Haiku is
  cheap. Could batch all criteria into one call as a later optimization — not v1.
- Column/criteria edits invalidate downstream synthesis → cascade re-runs
  synthesize (consistent with existing rescreen behavior).
- Decision-color contrast must be re-checked on the light theme (the old hues
  were tuned for dark); centralizing them makes this a single review point.
