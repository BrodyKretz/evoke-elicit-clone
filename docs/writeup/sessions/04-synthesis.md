# Session 4 — Synthesis agent (typed ReportBlock output)

**Date:** 2026-05-11
**Goal:** Turn the extraction table into the typed `ReportBlock[]` the existing `ReportView` already renders — paragraphs, headings, tables, notes blocks, all with structural integrity rather than markdown.

## What landed

- `lib/anthropic.ts` — `MODELS.synthesis = "claude-opus-4-7"`. Final-report quality matters most here; Opus earns it.
- `lib/agents/synthesize.ts`:
  - `generateTldr(question, extraction)` — one short Opus call, forced `record_tldr` tool returns one sentence. Synthesizes across rows, doesn't paraphrase a single paper.
  - `generateBody(question, extraction, criterion)` — long Opus call. Forced `record_report` tool with a `blocks` array whose item schema is the full 5-variant discriminated union (`anyOf` over paragraph / heading / sectionLabel / table / notes). System prompt prescribes structure (Abstract → Results → Summary) and style ("synthesize — do NOT just enumerate paper-by-paper", "use 'Insufficient data' honestly").
  - `synthesizeReport(question, extraction, criterion)` — orchestrates both calls in parallel.
  - Defensive coercion on the parsed block array — drop malformed blocks rather than crash; trust the schema validator but don't bet the whole render on it.
- `app/api/reports/route.ts` — adds Stage 4 after extraction. When synthesis succeeds, the run's `tldr` becomes the model's one-sentence answer (not the status-line summary), `initialView` shifts to `"report"`, and the report viewer lands the user directly on the synthesized output. `references` are populated from the papers carried into extraction — no separate LLM call needed.
- SDK bumped from `^0.40.1` → `^0.95.2`. The older type definitions didn't know about Opus 4.7 features (adaptive thinking, effort param).
- `scripts/test-synthesis.ts` — same isolated-test pattern. Feeds the prostate-cancer fixture's hand-written extraction table through synthesis, prints the structured output as readable text.

## What surprised me

- **"Thinking may not be enabled when tool_choice forces tool use."** Hit this with a 400 the first time. Adaptive thinking + forced tool output are mutually exclusive on the API. I kept the forced tool use (structural reliability of the typed-blocks output is non-negotiable) and dropped `thinking`, keeping `effort: "high"` as a partial substitute. Worth noting in the writeup as a real constraint when designing agents that need both reasoning depth and structured output.
- **Opus 4.7 without thinking is still really good.** The fixture output (TLDR + abstract + results table + notes block + summary, all with sensible cite counts) is structurally equivalent to the hand-written Lennox-Gastaut fixture. The system prompt's structure prescription does a lot of work — it's specific about the order of blocks and what each should contain.
- **The `cites` count is faithful.** Each paragraph reported the number of papers it actually drew on (2 + 2 in the abstract, then 2 + 4 in the summary). Not a hallucinated cite count. This worked because the prompt explicitly defined cites as "the count of distinct papers (rows) that support the paragraph's claims, not the column count" — the second clause prevented an off-by-one where the model might have used 4 (one per column) instead.
- **Generated table != extraction table.** The output table re-aggregates the extraction at a higher level (one row per paper but different columns: design / focus / target / approach), which is what an actual systematic review table looks like. The prompt's "subset/aggregate the extraction columns; do not copy verbatim" instruction held.
- **Schema enforcement on tool inputs is *less* strict than `output_config.format`.** I worried JSON-Schema with `anyOf` discriminated unions wouldn't validate; the API accepted the schema and the model emitted clean structured output anyway. Probably both schema validation AND prompt steering are doing work — even when validation is lenient, naming the variants in the schema gives the model strong priors.

## What I'd do differently

- The `pMap` helper now exists in three places (screen, extract, and the synthesis test script doesn't use it but easily could). Time to extract to `lib/utils/p-map.ts` next time it's needed.
- The synthesis prompt is long (~1000 chars of system text). At higher scale we should think about prompt caching — but Opus 4.7's caching minimum is 4096 tokens and our system prompt is ~250 tokens. Same issue as Sessions 2-3 — caching doesn't apply at this scale. The right move when we hit 1000-paper runs: cache the system prompt + extraction table (4096+ tokens) so successive runs on tweaked questions reuse most of the prefix.
- The block-coercion code is a fence around the parser; if the schema fails in an unexpected way, blocks just get dropped silently. A future iteration should surface a warning to the user when blocks were dropped, so we know the model's output isn't being mangled invisibly.
- Considered streaming for the body call (it took 20s); decided against because the SDK's streaming + tool_use flow is more complex and 20s is tolerable for a synchronous response. Session 5 (SSE for live progress) will revisit this naturally — at that point streaming each agent's output to the UI starts paying for itself.

## Open questions

- **Inline citations as paper IDs, not counts.** Right now `cites: number` is just a count, and the UI renders it as N ✱ markers. The "right" version is `cites: number[]` (paper indices) so the popover can show *which* papers. That's an additive change to the type + UI; deferred to quality iteration in Session 6+.
- **Block-level provenance.** Each cell in extraction already has inline quoted phrases as evidence; the synthesis loses that link. To bring it back at the block level, the body schema would need a `evidence: {paperId, cellRef}[]` field per paragraph, and the synthesis prompt would need to instruct the model to populate it. Defer.
- **Per-stage rerun.** When we add criterion editing or column editing, only screening/extraction need to rerun; synthesis can stay. The data model supports this (each stage has its own field on Report) but there's no endpoint yet.
- **`output_config.format` instead of forced tool use?** Would let us re-enable adaptive thinking. Trade-off: tools give us a known input_schema shape that's familiar; structured outputs (`output_config.format`) is the same idea via a different API surface. Worth a side-by-side test in Session 6+.

## Live end-to-end status

The full four-stage pipeline (gather → screen → extract → synthesize) is wired and type-checks. Each agent verified in isolation against fixture data. **Live end-to-end run still gated by Semantic Scholar's unauth soft-ban** — the only block to a real demo is at the very front of the pipeline. Same recommendation as the last three sessions: an S2 API key (free) will unblock the whole demo loop.

Next session is **Session 5 — Live progress via SSE**. The pipeline now takes ~30-45 seconds end-to-end (3s gather + 5s screen + 15s extract + 20s synth, parallelism within each stage). That's well past "loading spinner" UX. SSE on POST /api/reports streaming per-stage events into a live sidebar makes the run feel responsive instead of dead.
