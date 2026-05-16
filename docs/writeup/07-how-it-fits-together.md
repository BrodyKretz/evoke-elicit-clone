# How it all fits together

A worked example, end to end, against a real question we tested during development.

**Question:** "What are the most effective molecular targets for treatment of metastatic neuroendocrine prostate cancer in patients who have failed standard androgen deprivation therapy?"

## t=0s — Submission

User types the question into the home page hero. `Hero.tsx` posts to `/api/reports`. The API route:

1. Generates an 8-char hex id (`pc-a1b2`).
2. Persists an initial empty `Report` to `.evoke/runs.json` with `status.gather.done = false`.
3. Calls `runPipeline(id, question, initial)` — *without awaiting it*.
4. Returns `{id: "pc-a1b2", status: "started"}`.

Total elapsed: ~100ms. Client receives the id and routes to `/report/pc-a1b2/gather`.

## t=100ms — Live progress kicks in

The Gather view mounts. Because `status.generate.done === false`, it opens an `EventSource` against `/api/reports/pc-a1b2/stream`. The server-side SSE handler:

1. Subscribes the bus listener.
2. Sends `: connected\n\n` immediately to flush response headers (otherwise Next.js buffers them).
3. Replays history (empty so far).

Meanwhile, in the background, `runPipeline` is executing. The first thing it does is emit `{type: "stage.start", stage: "gather"}`. The bus dispatches that to the SSE listener, which writes `data: {...}\n\n` to the stream.

The client now sees "Gathering sources… (running)" in the live progress card.

## t=2s — Gather completes

Semantic Scholar returns 25 candidate papers. `runPipeline` emits `{type: "stage.done", stage: "gather", data: {sourcesFound: 25}}`. The UI flips the gather row to "done" and shows "25 sources from Semantic Scholar."

## t=2-5s — Screening

`runPipeline`:
1. Emits `stage.start screen`.
2. Calls `generateCriterion(question)` — one Haiku call, forced tool use, returns:
   > "The paper investigates molecular targets or therapeutic interventions for treating metastatic neuroendocrine prostate cancer in patients with resistance or progression after androgen deprivation therapy."
3. Emits `{type: "criterion", text: "..."}`. The UI displays the criterion in the live card.
4. Calls `screenPapers(papers, criterion, question, concurrency=3, onEvent)` — 25 Haiku calls in parallel batches of 3. Each completion emits a `progress` event.
5. Per-paper output: `{paperId, decision: include|exclude|maybe, rationale}`.

End of stage: 8 included, 6 maybe, 11 excluded. `stage.done screen` event with the counts.

## t=5-15s — Extraction

`runPipeline` filters papers to `decision != "exclude"` (14 papers), then:

1. Emits `stage.start extract`.
2. Calls `generateColumns(question)` — one Sonnet call, returns:
   - "Study Methodology"
   - "Patient Population"
   - "Molecular Target / Agent"
   - "Treatment Efficacy Outcomes"
3. Emits `{type: "columns", columns: [...]}`. The UI displays the columns inline.
4. Calls `extractPapers(papers, question, concurrency=3, onEvent)` — 14 Sonnet calls in parallel batches of 3, each progress-emitted.

Each cell ends up populated with concise text, with single-quoted phrases acting as inline provenance (e.g. `'EGFR' (positive in 61.2% of patients)`). Cells that the abstract doesn't address get `"Insufficient data"` or `"Not reported in abstract"`.

Stage ends with `stage.done extract, data: {dataPointsExtracted: 56, rows: 14}`.

## t=15-35s — Synthesis

`runPipeline`:
1. Emits `stage.start synthesize`.
2. Calls `synthesizeReport(question, extraction, criterion.text)` which fires two Opus 4.7 calls in parallel:
   - `generateTldr` returns a one-sentence answer.
   - `generateBody` returns a typed `ReportBlock[]` — 10 blocks: section labels, paragraphs with `cites` counts, a results table, a notes block with summary statistics, a conclusion.
3. Emits `{type: "tldr", text: "..."}` mid-stream. The UI shows the TLDR as it lands.
4. Emits `stage.done synthesize`.

## t=35s — Complete

`runPipeline`:
1. Calls `saveRun` with the final, complete `Report`.
2. Emits `{type: "complete"}`.

On the client, the Gather view's effect catches the `complete` event, pauses 800ms (let the user see the final check tick), and `router.replace`s to `/report/pc-a1b2/report`.

The report viewer's layout calls `getReport("pc-a1b2")`. Server component, server-side. The persisted Report has full data: status all `done`, synthesized `report` block array, references list, populated screening + extraction. `ReportView` renders the structured blocks: section labels, paragraphs with cite markers, the table, the notes, references.

## Re-screening (post-completion)

The user opens the Search Results tab. The criterion card shows the auto-generated criterion with an "Edit & re-screen" button. Editing the criterion text and clicking Apply hits `POST /api/reports/pc-a1b2/rescreen` with the new criterion:

1. Backend re-runs screening on the existing 25 gathered papers (no S2 call, no extraction, no synthesis).
2. ~3 seconds, 25 Haiku calls.
3. Persists the new screening, invalidates extraction + report.
4. Returns counts.

Client gets the response, fires `router.refresh()`, the SearchView re-renders with new badges in place.

## What this whole flow buys you

Each stage emits the artifacts the next stage needs and announces itself to the UI. Failures at any point are surfaced inline, not silently. The user always knows what's happening and never sees a frozen spinner. The cost shape is predictable: ~$0.15-0.25 per full run, with the option to refine the criterion at ~$0.02 per re-screen.

That's the whole product, in one ~35-second walk-through. The rest of the engineering is making it survive the edge cases.
