# Extract data

The third stage. Job: turn the screened-in papers into a structured table — columns derived from the research question, cells filled per paper from the abstract.

## Two-pass approach

The naive implementation has fixed columns ("Study Design / Sample Size / Outcomes"). That works for some questions and fails for many. The "what's the most effective molecular target in NEPC?" question doesn't have a useful "Study Design" column; it needs a column about *which target* and *what evidence*.

So extraction has two passes:

1. **`generateColumns(question)`** — one Sonnet call. Forced `propose_columns` tool returns exactly 4 column headers tailored to the question.
2. **`extractFromPaper(paper, columns, question)`** — one Sonnet call per paper. Forced `record_extraction` tool returns exactly N cell strings, one per column.

The system prompt for column generation explicitly forbids a "Paper" column (the UI renders that itself), requires headers be 2-5 words, and instructs the model to dedicate one column to a question-specific dimension.

For the NEPC question above, this produced:
1. Study Methodology
2. Patient Population
3. Molecular Target / Agent
4. Treatment Efficacy Outcomes

These are exactly what a real systematic review on this topic would have. Column 4 (`Treatment Efficacy Outcomes`) is specifically tailored to "what's most effective" — the question-aligned column the prompt asked for.

## Why Sonnet here, not Haiku

Screening is yes/no with a one-sentence rationale. That's the kind of judgment Haiku is good at — pattern match against a clear criterion, output structured decision.

Extraction is *cell-by-cell field filling* with two harder constraints:
- **Honesty about gaps.** The abstract might not say what the sample size was. The model has to write "Insufficient data" or "Not reported in abstract" rather than making something up.
- **Inline provenance.** When the abstract does say, the model should signal that — Evoke's convention is single-quoted phrases inside cells, so a reader can see what came directly from the paper vs what's the model's paraphrase.

My early test with Haiku for extraction surfaced the model hallucinating sample sizes for papers whose abstracts didn't state them. The "Insufficient data" instruction was being ignored ~30% of the time. Sonnet on the same prompts: zero hallucinations across the test set, "Insufficient data" used appropriately. The cost increase (~3-5x) is small compared to the reliability win.

## Quote-as-provenance hack

Real per-cell provenance is `{value, sourceSpan: {paperId, quote, charOffset}}` — the cell carries both its value and the exact phrase in the abstract that supports it. The UI would highlight the source phrase on hover.

I didn't build that. Instead the system prompt instructs the model:
> Quote short phrases from the abstract when they carry meaningful evidence — wrap them in single quotes.

So a cell ends up looking like:
> EGFR ('positive in 61.2% of patients') and PDGFR-β ('strong cytoplasmic staining in 38%')

This isn't a structural link — the UI can't auto-highlight the quote in the abstract. But visually, single quotes signal "this came from the paper" vs unquoted model paraphrase. It's 5% of the value of proper provenance at 1% of the engineering effort. Worth keeping as a stopgap.

## Filter to non-excludes

The extraction stage operates on papers where the screening decision was `"include"` or `"maybe"`. Excludes are dropped — extracting from them would burn $ for no value (synthesis isn't going to cite excluded papers).

For the prostate-cancer test (4 papers, all included), this is a no-op. For real runs with 25 gathered papers and ~10-15 included, this saves ~$0.04 per run.

## Cost

Per Sonnet call: ~1500 input + ~800 output tokens. At $3/$15 per million: $0.005 + $0.012 = ~$0.017 per paper.

Plus one column-generation call at ~$0.005.

For ~10 included papers: **~$0.18 total**. The most expensive single stage in the pipeline by a wide margin.

## Defensive coercion

The tool input schema declares `minItems: 4, maxItems: 4` for `cells`. The schema validator should enforce this. In practice I pad/truncate defensively:

```ts
while (cells.length < columns.length) cells.push("Insufficient data");
return cells.slice(0, columns.length);
```

Same with column generation — if the model returns 3 columns when we asked for 4, we add `"Notes"` rather than crash. The schema constraint catches almost everything; the coercion handles the edge cases without burning a retry.

## What lives in this stage's output

`{columns: string[], rows: { paper: Paper, cells: string[] }[]}`:

The shape exactly matches what `ExtractionView` already expected from fixtures, which is intentional — the agent's job is to produce data that drops into the existing UI with no transformation.

## Open questions

- **Why exactly 4 columns?** The `COLUMN_COUNT = 4` constant is the right ballpark for most questions but probably too few for some. Elicit's real reports often have 5-7 columns. Worth A/B testing 4 vs 6.
- **Re-running extraction with different columns.** Currently the columns are auto-generated once and locked. Letting the user edit them ("add a column for safety profile") and re-run extraction would close a feedback loop similar to the criterion-editing one.
- **Cross-cell consistency.** Each paper's extraction is independent. The model has no view of "papers 1 and 3 disagree on the methodology classification." A second pass that reviews all rows for consistency might tighten the cells. Out of scope.
- **Full-text extraction.** The biggest quality unlock. Abstract-only extraction caps fields like "exact sample size" and "primary outcome confidence interval" at "Insufficient data" because abstracts often skip the numbers. Adding PDF retrieval and chunked extraction over the full paper would unlock these fields. Substantial engineering work, deferred.
