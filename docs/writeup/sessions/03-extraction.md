# Session 3 — Extraction agent (column gen + per-paper cells)

**Date:** 2026-05-11
**Goal:** After screening, auto-generate column headers for an extraction table and fill cells per included paper. Run only on screened-in / maybe papers — exclude the excludes.

## What landed

- `lib/anthropic.ts` — added `MODELS.extraction = "claude-sonnet-4-6"`. Sonnet earns its keep here; Haiku was too brittle on the early test pass for "use 'Insufficient data' if absent" prompting.
- `lib/agents/extract.ts`:
  - `generateColumns(question)` — one Sonnet call, forced tool use returns exactly 4 column headers (configurable via `COLUMN_COUNT`). System prompt explicitly forbids a "Paper" column since the UI renders that meta column itself.
  - `extractFromPaper(paper, columns, question)` — one Sonnet call per paper, forced `record_extraction` tool returns exactly N cell strings. Defensive pad/truncate in case the model under/overshoots.
  - `extractPapers(papers, question, concurrency = 3)` — runs column generation once, then fan-outs to per-paper extraction with bounded parallelism. Per-paper failures degrade to "Extraction failed" cells rather than killing the run.
- `app/api/reports/route.ts` POST extended:
  - After screening, filters `screenable` papers to those with decision ∈ {include, maybe} — `exclude` papers are dropped from extraction (they'd burn $ for no value).
  - Runs the extraction stage with all the same try/catch + status surfacing pattern as the earlier stages.
  - `initialView` for new runs is now `"extraction"` when extraction completes, so the user lands directly on the most actionable view.
  - `tldr` is now a multi-clause sentence built from each stage's outcome (gathered N → screened to M → extracted X data points).
- `scripts/test-extraction.ts` — isolated smoke test against the prostate-cancer fixture. Same pattern as `test-screening.ts`.

## What surprised me

- **The auto-generated columns are *uncannily* good.** Test run on the metastatic NEPC question produced:
  1. Study Methodology
  2. Patient Population
  3. Molecular Target / Agent
  4. Treatment Efficacy Outcomes

  These are basically what a real systematic review on this topic would have. Column 4 (`Treatment Efficacy Outcomes`) is specifically tailored to "what's most effective" in the question — exactly what the prompt asked for. One Sonnet call, ~$0.005.
- **The "wrap quotes in single quotes" provenance hack works.** Cells like `'EGFR' (positive in 61.2% of patients)` make it visually obvious which phrases came directly from the abstract. No new UI work, no source-span tracking, and the reader still gets a sense of evidence. Worth keeping when we eventually add proper per-cell citation popovers.
- **Sonnet handles "Insufficient data" honestly.** Multiple cells across the 4-paper run came back as "Insufficient data" or "not reported in abstract" — including a review paper that had no quantitative outcomes. The system prompt's `Do NOT invent values` clause is doing real work. If I'd used Haiku here, my prior is that it would have generalized harder.
- **Time + cost are reasonable.** 4 papers + column-gen call in 8.9s, ~$0.07. That puts a real ~10-paper run at ~$0.20 and ~15-20s. Below the 30s threshold where I'd want streaming, but not by much. Adding screening + extraction together puts a full pipeline at ~$0.10-0.25 per run.
- **The COLUMN_COUNT = 4 constant is suspiciously load-bearing.** When the model returned columns, the schema enforced `minItems` and `maxItems` of 4, but the column-generation prompt was where the real "exactly 4" instruction lived. If I bumped this to 6 I'd want to retune the prompt's "guidelines" to spread the column types more.

## What I'd do differently

- The `pMap` helper is now copy-pasted in both `screen.ts` and `extract.ts`. Per CLAUDE.md ("Two similar blocks might be coincidence; extract when the duplication is causing actual problems"), I'm at two and tolerating it. Will extract to `lib/utils/p-map.ts` only when a third copy shows up.
- The "screened-in + maybe" filter is implemented inline in the API route. Should probably move that into a `selectScreenedIn(papers, screening)` helper in `lib/agents/screen.ts` — it'll be reused in Session 4 (synthesis only summarizes screened-in papers).
- Per-cell source provenance is currently just inline quoted phrases. The real version needs `{value, sourceSpan: {paperId, quote, charOffset?}}` per cell, so the UI can render hover popovers with proper anchoring. Defer until UI work in Session 4 surfaces it.

## Open questions

- **Failure of one paper, success of others.** Right now I log + insert "Extraction failed" cells. Should the UI distinguish those visually? (Grey-out the row, badge it?) Defer until a real failure occurs in practice.
- **Re-runs and idempotency.** No mechanism today to re-run just the extraction stage on an existing run. When we add criterion editing (Session 6 quality iteration probably), this becomes urgent — re-screen invalidates extraction.
- **Column count.** Elicit's real reports often have 5-7 columns. We're at 4. Worth bumping after we've tuned the synthesis stage (Session 4) — the synthesis prompt will tell us whether more columns help or just add noise.
- **What about no-abstract papers?** They're already filtered out in screening. But if the user adds a "Look up full text" mode later, extraction would also need to know how to gracefully degrade. Not blocking.

## End-to-end status

Full pipeline (gather → screen → extract) is wired and type-checks. **Live end-to-end run is gated by Semantic Scholar's unauth-tier soft-ban**, which has been persistent across the last few testing windows. Each agent verified in isolation via its smoke test script. Adding a SEMANTIC_SCHOLAR_API_KEY would unblock end-to-end verification immediately.
