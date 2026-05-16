# Generate report

The fourth stage. Job: turn the extraction table into a narrative research report with citations, tables, and summary statistics. Output: a typed `ReportBlock[]` plus a one-sentence TLDR.

This is the hardest agent in the pipeline. It has to:
- *Synthesize* across all papers, not just enumerate them.
- Pick which dimensions of the extraction to elevate into a summary table.
- Aggregate metadata (study designs, sample sizes) into a notes block.
- Cite the right papers from each claim.
- Stay structurally consistent (sections in order, headings at the right level).

It also fires Opus 4.7, the most expensive model in the stack, because final-report quality is what the user actually sees.

## Two parallel calls

`synthesizeReport(question, extraction, criterion)` fires two Opus calls in parallel:

1. **`generateTldr`** — short call, forced `record_tldr` tool returns one sentence answering the research question. Synthesizes across the extraction rather than paraphrasing one paper.
2. **`generateBody`** — longer call, forced `record_report` tool returns a `blocks: ReportBlock[]` array.

Running them in parallel saves ~5 seconds vs sequential. They have independent inputs and outputs; no reason to serialize.

## The `ReportBlock` discriminated union

The body output schema is the centerpiece of the agent's design. `ReportBlock` is a 5-variant union, discriminated on `kind`:

```ts
type ReportBlock =
  | { kind: "paragraph"; text: string; cites?: number[] | number }
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "sectionLabel"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "notes"; title?: string; items: NotesItem[] };
```

The agent's tool `input_schema` mirrors this exactly using JSON Schema's `anyOf` over the 5 variants. The system prompt prescribes which blocks must appear and in what order:

1. `sectionLabel: "Abstract"`
2. 2 `paragraph` blocks summarizing findings, each citing the supporting papers
3. `sectionLabel: "Results"`
4. `heading: level 3` for the main results section
5. 1 `table` block summarizing the most useful cross-paper dimension
6. 1 `notes` block with summary statistics
7. `sectionLabel: "Summary"`
8. 1-2 `paragraph` blocks concluding the report

The schema doesn't enforce this order — JSON Schema can't easily express "exactly these block types in exactly this sequence." The prompt does the structural work. In practice, every successful generation has matched the spec.

## The thinking + forced-tools constraint

Synthesis is the most reasoning-heavy stage. The natural API choice would be `thinking: {type: "adaptive"}` + `effort: "high"` so the model thinks deeply before producing the structured output.

First attempt hit a 400:
> "Thinking may not be enabled when tool_choice forces tool use."

Real constraint. The API doesn't let you combine the two. I had to choose:
- **Forced tool use → no thinking**, or
- **Thinking → no forced tool use** (model has to choose to call the tool)

I picked forced tool use. The structural reliability of the typed-blocks output is non-negotiable; without it, the UI would need to handle "the model decided to just emit prose this time." Effort=high stays — it's a partial substitute for thinking, controlling thinking depth and token spend even with thinking technically off.

Worth flagging in the writeup as a real design choice that affects how you build agents needing both reasoning depth and structured output. The architectural workarounds (if you must have both) are either:
- Use `output_config.format` with json_schema instead of forced tool use (allows thinking)
- Two-stage prompt: one call with thinking that produces freeform reasoning, then a second call (with forced tool use) that structures the result

Neither is built; both are deferred.

## Cite arrays for linkable citations

Original implementation had `cites: number` — a count, rendering as N anonymous ✱ markers. That works visually but is informationally lossy.

Session 6+ refactor: `cites: number[]` — 1-based paper indices into `Report.references`. Now each cite marker links to a specific paper. The UI's `Cite` component checks the type at runtime: if it's an array, render linked `[1] [3]` markers with paper details on hover; if it's a number (legacy fixtures), render N anonymous markers.

The agent's prompt now says:
> Paragraph `cites` is a 1-based index array into the papers list above (e.g. `[1, 3]` for papers 1 and 3).

Schema enforces `array of integers ≥ 1`. The model correctly maps claims to papers in test runs.

## Generated table != extraction table

The body's table block is *not* the extraction table copied verbatim. The prompt explicitly says:
> Summarize the most useful cross-paper dimension (subset/aggregate the extraction columns; do not copy verbatim).

In practice, the model re-aggregates. For the NEPC test, the extraction had columns:
- Study Methodology / Patient Population / Molecular Target / Treatment Efficacy Outcomes

The synthesized table had:
- Paper / Design / Key Targets / Evidence-Yield

A different cut — fewer columns, more aggregate phrasing, one row per paper. That's what a real systematic review table looks like; verbatim duplication of the extraction would be boring and uninformative. The prompt instruction does real work.

## Cost and timing

Two Opus 4.7 calls in parallel, ~$0.09 total, ~20 seconds wall-clock. Single biggest LLM expense per run.

I considered streaming the body call (would let the UI show paragraphs as they generate). The SDK's streaming + tool-use flow is more complex than non-streaming. Decided 20 seconds is tolerable, and Session 5's SSE-based per-stage events are sufficient progress signal for now. Streaming individual tokens within the synthesis call is a quality iteration item.

## TLDR specifically

The TLDR call has its own prompt:
> You write a single-sentence answer to a research question, based on a structured extraction table of papers. The answer should be factual, specific, and synthesize across the papers — not just paraphrase one.

Test output for the NEPC question:
> For metastatic neuroendocrine prostate cancer progressing after androgen deprivation, the most promising molecular targets are the AURKA/N-Myc axis and EZH2 driving neuroendocrine transdifferentiation, alongside ancillary targets such as PEG10, FOXA1, EGFR, PDGFR-β, and cytochrome P450 steroidogenic enzymes (17,20-lyase, aromatase), with AURKA inhibition (e.g., alisertib) showing the strongest selective vulnerability in TP53/RB1-deficient tumors.

Specific. Names drugs. Distinguishes NEPC-specific evidence from broader prostate cancer findings. Hedges appropriately ("most promising," "showing the strongest selective vulnerability") because the evidence is preliminary. Not paraphrasing any one paper.

## Open questions

- **Block-level provenance.** Each cell in extraction has inline quoted phrases as evidence. The synthesis loses that link — paragraphs cite papers, but not specific cells. To bring it back, the body schema would need `evidence: {paperId, cellRef}[]` per paragraph. Defer.
- **Style customization.** Currently every report has the same Abstract/Results/Summary structure. Letting the user pick a "short report" / "long report" / "policy brief" template at synthesis time is an obvious extension.
- **Re-running synthesis.** When the user edits a screening criterion (Session 6) or extraction columns (future), the synthesis is invalidated. Right now they have to manually re-trigger; auto-cascade is the natural UX.
- **Output schema sturdiness.** Schema enforcement on tool inputs is less strict than `output_config.format`. I worried JSON-Schema with `anyOf` discriminated unions wouldn't validate cleanly; in practice the API accepted the schema and the model emits clean structured output anyway. Both schema validation AND prompt steering are doing work — even when validation is lenient, naming the variants in the schema gives the model strong priors.
