# Code tour

A reading order for anyone (or any future Claude) opening this codebase cold. Files are listed in the order I'd recommend reading them.

## Start here

### `lib/types.ts`
The data contract for the entire system. `Paper`, `ScreeningResult`, `Extraction`, `ReportBlock`, `Report`. Every agent's output, every UI render path, every API response shape ultimately conforms to these types. Spend 5 minutes on this file; everything else follows from it.

Key shapes:

- `Report` — the central object. Has fields for each pipeline stage's output. Per-stage fields are optional so the type also models "in flight" runs.
- `ReportBlock` — the discriminated union of typed blocks the synthesis agent emits (paragraph / heading / sectionLabel / table / notes).
- `Cites` — `number | number[]`. Backward-compatible with hand-written fixtures (numeric count) and forward-compatible with agent-generated runs (array of 1-based paper indices).
- `Screening` — `{criteria, results}`. Currently always one criterion; the array shape leaves room for multi-criterion screening later.

## The agents

### `lib/anthropic.ts`
Singleton client wrapper. Fail-fast if `ANTHROPIC_API_KEY` is missing. `MODELS` map names the model used at each stage so the agent files pick by purpose, not by string.

### `lib/agents/screen.ts`
Two exports:
- `generateCriterion(question)` — one Haiku call, forced `propose_criterion` tool.
- `screenPapers(papers, criterion, question, concurrency, onEvent)` — fan out Haiku calls via `pMap`, emit progress events, drop failed papers (don't fail the run).

### `lib/agents/extract.ts`
Three exports:
- `generateColumns(question)` — one Sonnet call, forced `propose_columns` tool, returns exactly 4 column headers.
- `extractFromPaper(paper, columns, question)` — internal; one Sonnet call per paper.
- `extractPapers(papers, question, concurrency, onEvent)` — fan out; returns `{columns, rows: [{paper, cells, evidence}]}` where evidence carries quoted phrases.

### `lib/agents/synthesize.ts`
Three exports:
- `generateTldr(question, extraction)` — one Opus call, forced `record_tldr` tool.
- `generateBody(question, extraction, criterion)` — one Opus call with `effort: "high"`, forced `record_report` tool whose `input_schema` is the discriminated union of `ReportBlock`. Defensive coercion of the parsed block array (drop malformed blocks rather than crash).
- `synthesizeReport(question, extraction, criterion)` — orchestrates the two calls in parallel.

### `lib/agents/chat.ts`
The post-synthesis assistant. Two exports:
- `buildChatSystemPrompt(report)` — assembles the scope-bounded system prompt by formatting papers, extraction table, and report blocks.
- `chat(report, history, userMessage, onChunk)` — streams an Opus response chunk-by-chunk via the SDK's streaming helper.

The system prompt is the only thing keeping the chat scoped — there's no tool-level constraint, just clear instructions and the absence of any external-knowledge tool.

## The pipeline runner

### `lib/pipeline.ts`
Two entry points, both async (kicked off without await):
- `runPipeline(runId, question, initial)` — full gather → screen → extract → synthesize.
- `runFromScreening(runId, question, report, papers, criterionOverride)` — for rescreen cascades. Emits a synthetic `gather.done` event up front so the UI shows gather as already complete.

Both call into `runScreenExtractSynth` for the shared screen/extract/synthesize body. Each stage:
1. Emits `stage.start`.
2. Runs the agent, threading `onEvent` through for progress events.
3. On success: emits `stage.done` with payload, merges results into the in-memory `report`.
4. On error: emits `stage.error`, emits terminal `error`, calls `persistAndFinalize` to write the partial run, returns.

After the synthesize stage: `saveRun(report)` and `emit("complete")`.

## The bus and the SSE endpoint

### `lib/events.ts`
The pipeline → UI event bridge.

- `PipelineEvent` union: `stage.start | stage.done | stage.error | criterion | columns | progress | tldr | complete | error`.
- Module-level `Map<runId, RunState>` where `RunState = {bus: EventEmitter, history: PipelineEvent[], closed: boolean}`.
- **The Map is anchored to `globalThis`** because Next.js dev mode loads server modules into separate bundles per route — without this, the POST handler and the SSE handler each get their own (empty) Map and never see each other's events. This is the single most important debugging story in the codebase.
- `emit(runId, event)` — write to history + dispatch to bus listeners.
- `subscribe(runId, onEvent)` — returns `{history, closed, unsubscribe}` so the caller can replay then tail.
- `makeEmitter(runId)` — convenience curry that the pipeline uses.

### `app/api/reports/[id]/stream/route.ts`
SSE endpoint. Returns `Content-Type: text/event-stream`, subscribes to the run's bus, replays history, tails new events until `complete`/`error`.

Two critical details:
1. Emits an initial `: connected\n\n` comment to force header flush — without this, Next.js buffers the response and Node fetch clients time out waiting for headers.
2. `export const dynamic = "force-dynamic"` to prevent Next.js from trying to cache/optimize the streaming response.

## The API routes

### `app/api/reports/route.ts`
- `GET` — list all reports (fixtures + stored runs).
- `POST` — validate question, persist initial empty `Report`, kick off `runPipeline` async, return `{id}` in <100ms.

### `app/api/reports/[id]/route.ts`
- `GET` — single report by id.

### `app/api/reports/[id]/rescreen/route.ts`
- `POST` — validate criterion, reset downstream state (extract + synth fields cleared, status flipped to in-flight), kick off `runFromScreening` async, return `{id}`.

### `app/api/reports/[id]/chat/route.ts`
- `POST` — validate request, return SSE stream of `{type: "delta", text}` events from `chat(...)`. Closes on `done` or `error`.

### `app/api/search/route.ts`
- Legacy `POST` endpoint that hits Semantic Scholar directly. Used by the old search UI flow before POST `/api/reports` took over. Still in the codebase for completeness.

## The store

### `lib/store.ts`
JSON-file persistence at `.evoke/runs.json`. Three functions:
- `saveRun(report)` — write-through; mkdirs as needed.
- `getRun(id)` — read; returns undefined for missing.
- `listRuns()` — all stored runs.
- `newRunId()` — `crypto.randomUUID().split("-")[0]`, gives 8-char hex ids.

### `lib/data/reports.ts`
Merges fixtures + store. `getReport(id)` checks fixtures first (so seeded reports are immutable), falls back to the store. `listReports()` returns the union.

### `lib/data/fixtures/*.ts`
Three baked-in reports (`lennox-gastaut`, `cbt-depression`, `prostate-cancer`) at different pipeline states. These exist for demo purposes and for the test scripts to run against without needing S2/Anthropic calls.

## UI shell

### `app/layout.tsx`
Root layout. Sets up fonts (Manrope + Fraunces via `next/font/google`), `<ToastProvider>`, body background.

### `app/page.tsx`
Home page. Hero with question input + three example report cards + pipeline-stage overview card.

### `app/report/[id]/layout.tsx`
Wraps every report view. Pulls the report (fixture or stored), renders `<TopBar>`, `<Tabs>`, and a two-column grid: `{children}` (the active tab's content) + `<StatusSidebar>`.

### `app/report/[id]/page.tsx`
Redirects to the appropriate tab based on `report.initialView` (e.g. completed runs go to `/report`, in-flight ones to `/gather`).

### `app/report/[id]/{report,extraction,search,gather,examples}/page.tsx`
Five tabs, each is a thin wrapper that pulls the report and renders the matching view component.

## UI view components

### `components/report/ReportView.tsx`
Renders the synthesized report. Iterates `report.report` (the `ReportBlock[]`) and dispatches to the right renderer per block kind. Cite markers render via `<CiteCluster>`, which resolves paper indices against `report.references`.

### `components/report/DataTable.tsx`
The interactive table used inside report blocks. Per-column filter popovers + sort.

### `components/extraction/ExtractionView.tsx`
Renders the per-paper extraction table. Each cell shows its value + an expandable `<details>` panel with the LLM-extracted evidence quotes.

### `components/search/SearchView.tsx`
The screening view. Criterion card at top (editable for user-created runs), filter pills (Include/Maybe/Exclude/All with counts), one card per paper with a screening badge.

### `components/gather/GatherView.tsx`
For in-flight runs: subscribes to SSE, renders a live progress card showing each stage's state + interesting payloads (criterion, columns, TLDR). On `complete`, navigates to `/report`. For completed runs: shows the original ranked paper list as static cards.

### `components/examples/ExamplesView.tsx`
The examples tab — three links to the seeded fixtures.

## UI layout components

### `components/layout/TopBar.tsx`
The top bar — back button, report title, progress dots, action buttons.

### `components/layout/Tabs.tsx`
The 5-tab nav. Active tab inferred from `usePathname()`.

### `components/layout/StatusSidebar.tsx`
The right-hand sidebar. Per-stage status list (with details/download buttons depending on completion) + `<ChatPanel>`. Markdown download is wired through `lib/utils/export-markdown.ts`.

### `components/layout/ChatPanel.tsx`
The chat-with-this-report panel. Disabled when `status.generate.done === false`. Streams Opus responses chunk-by-chunk to the message list. Enter sends; Shift-Enter newlines.

## UI primitives

### `components/ui/Cite.tsx`
Citation marker. When given a `paper` prop, the marker shows the paper's index, clicking opens an inline popover with full bibliographic info. Without a paper (legacy fixtures), falls back to a toast.

### `components/ui/Toast.tsx`
Provider + `useToast` hook. Single ephemeral toast at the bottom of the screen.

### `components/ui/Icon.tsx`
SVG icons inlined as React components. No icon-library dependency.

## Utilities

### `lib/utils/p-map.ts`
Bounded-parallelism map. Preserves output order. Used by screen and extract for fan-out.

### `lib/utils/cn.ts`
Wrapper around `clsx`. One-line; could've stayed inline but every component uses it.

### `lib/utils/export-markdown.ts`
Renders a `Report` to portable Markdown. Used by the sidebar Download button.

### `lib/semantic-scholar.ts`
S2 API client. `searchPapers(query, limit)` returns `Paper[]`. Retry-with-exponential-backoff on 429/5xx.

## Test scripts

### `scripts/test-{screening,extraction,synthesis,chat}.ts`
Per-agent smoke tests. Each loads a fixture, runs the agent against its data, prints structured output. Bypasses S2 entirely. Run with `set -a && source .env.local && set +a && npx tsx scripts/test-{name}.ts`.

### `scripts/test-sse.ts`
End-to-end SSE smoke test. POSTs a real run to the dev server, opens the stream, prints events.

### `tests/*.test.ts`
Unit tests, run with `npm test`. Currently covers `pMap` and the markdown exporter.

## Configuration

### `package.json`
Dependencies are intentionally minimal: `next`, `react`, `react-dom`, `clsx`, `@anthropic-ai/sdk`. Dev deps: `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `tsx`.

### `tailwind.config.ts`
Custom design tokens — cream/teal palette, Manrope (sans), Fraunces (display). All semantic color names are project-specific (`bg`, `surface`, `teal`, `text`, `chip`, `examples`) rather than Tailwind's generic palette.

### `next.config.mjs`
Bare-bones. `reactStrictMode: true`.

### `tsconfig.json`
Strict mode on, `@/*` path alias for project root, ESnext modules.
