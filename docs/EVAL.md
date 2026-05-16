# Evaluation plan

> **Status: outlined, not yet built.** A small benchmark for measuring the quality of each pipeline stage. Defer execution until an S2 API key is in hand (without it the gather stage 429s and the rest of the eval can't run).

## Why we need this

Right now the pipeline is tuned by inspection. The agents look good on the fixture data and on a handful of ad-hoc test questions. That's not enough to ship:

- The auto-generated screening criterion could be drifting toward "too narrow" or "too broad" on some question types.
- The extraction columns could be missing dimensions a domain expert would have picked.
- The synthesis report could be over- or under-weighting which findings to emphasize.

Without an eval loop you can't measure regressions when changing prompts, and you can't tune the cost/quality frontier.

## What to benchmark

A small set of research questions where the "right answer" is somewhat known. ~30 questions across ~3 domains is enough to start.

### Per-question fixtures

For each benchmark question, capture:
- The question text
- A list of "gold-standard" paper IDs that a domain expert would include in a review (3-10 per question)
- One or two "obvious distractor" paper IDs (topically similar but clearly off-topic)
- A short rubric: 3-5 expected dimensions / claims a good synthesis would touch on

Sourcing: borrow from published Cochrane reviews and from Elicit's public report URLs (the three example reports in `lib/data/fixtures/` are already in this format, modulo the gold-standard annotation).

### Metrics

| Stage | Metric | How |
|---|---|---|
| Gather | Recall@25 | Fraction of gold-standard papers in S2's top 25 |
| Screen | Precision/Recall | Compare include/maybe/exclude vs hand labels on gold + distractor papers |
| Extract | Field accuracy | Manual spot-check: are quoted phrases real? Is "Insufficient data" used honestly? |
| Synthesize | Rubric coverage | Does the report touch each expected dimension? |
| End-to-end | Cost + wall-clock | Tokens × per-model price |

### Anti-tests (negative cases)

A few queries that *shouldn't* return anything coherent:
- Nonsense questions ("What is the molecular structure of the color blue?")
- Off-topic questions ("Best pizza in Brooklyn")
- Ambiguous questions ("Is X effective?")

The pipeline should fail loudly (empty result, refusal, "Insufficient data" in the synthesis), not silently produce a confident-sounding nonsense report.

## Implementation sketch

```
eval/
  questions.json           # benchmark fixtures
  run.ts                   # iterate questions, run pipeline, score
  report.ts                # render results as markdown
  results/                 # per-run outputs (gitignored)
```

Each eval run produces a markdown report with per-question precision/recall, rubric coverage, total cost, and any failures. Diff vs previous run highlights regressions.

## When to run

- After significant prompt changes (any new system prompt, any tool schema change)
- Before merging changes that touch agent code
- Quarterly as a smoke check that S2 and Anthropic outputs haven't drifted

## Cost ceiling

30 questions × ~$0.20 per run = ~$6 per full eval. Tolerable. Reduces to ~$3 with prompt caching on shared system text once the corpus is bigger.

## What this *isn't*

This is internal eval, not user-facing quality assurance. For a real product I'd also want:
- Per-user thumbs-up/down on report quality, aggregated
- Spot audits by domain experts for high-stakes domains (medical, legal)
- A re-eval whenever a new Claude model lands
