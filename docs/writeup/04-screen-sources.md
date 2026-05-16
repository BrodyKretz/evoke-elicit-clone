# Screen sources

The second stage. Job: for each gathered paper, decide if it actually meets a stated inclusion criterion. Output: `{decision: "include" | "exclude" | "maybe", rationale}` per paper.

## Why this stage exists

S2's gather returns papers ranked by similarity to the keywords in the question. That's necessary but not sufficient. For "What's the most effective molecular target for treatment of metastatic neuroendocrine prostate cancer after androgen deprivation failure?":

- S2 surfaces papers about prostate cancer generally, not just NEPC.
- It surfaces older papers about ADT before the NEPC sub-phenotype was well-characterized.
- It surfaces review articles that overlap topically but don't add novel evidence.

Without a screening stage, the downstream extraction agent would extract data from 25 papers when 8-12 of them are actually relevant. Worse, the synthesis agent would weight non-relevant evidence equally with relevant evidence. **Screening is the funnel.**

## Two LLM calls, not one

The plan called for "screen each paper against one criterion." But that begs the question: where does the criterion come from?

The auto-generated answer: another LLM call. `generateCriterion(question)` is one Haiku call that returns a one-sentence inclusion criterion from the question alone. For the NEPC question above, it produces:

> "The paper investigates molecular targets or therapeutic interventions for treating metastatic neuroendocrine prostate cancer in patients with resistance or progression after androgen deprivation therapy."

That's a real, gradable criterion — specific enough that "include" / "exclude" decisions are feasible from an abstract.

Then `screenPaper(paper, criterion, question)` is one Haiku call per paper. Returns a forced `record_decision` tool call with `{decision, rationale}`. Bounded parallel via `pMap(papers, 3, ...)`.

## Why Haiku

Per-stage model selection: Haiku 4.5 is $1/$5 per million tokens (vs $3/$15 Sonnet, $5/$25 Opus). At ~25 papers per run × ~400 tokens per call, screening costs **~$0.01-0.02 total**. Sonnet would be ~$0.04, Opus ~$0.06 — meaningful when this is the most volume-heavy stage in the pipeline.

I worried Haiku would over-trigger "include" on borderline cases. The early test against the prostate-cancer fixture's 4 papers had me prepared to upgrade. Instead I got:
- 2 INCLUDE: NEPC-specific papers
- 1 EXCLUDE: a paper on regular prostate adenocarcinoma (not NEPC)
- 1 MAYBE: an AIPC paper that doesn't confirm NEPC subtype

Every rationale cited a specific aspect of the abstract. The decisions were sensible. Haiku stays.

## Forced tool use, not JSON-in-prompt

The screening prompt could ask Claude to "respond in JSON with fields decision and rationale." That works most of the time. Some percentage of calls would emit slightly malformed JSON (a stray markdown fence, a trailing comma) and require defensive parsing.

Instead I use the API's `tool_choice: {type: "tool", name: "record_decision"}` to *force* Claude to invoke a specific tool whose `input_schema` mirrors the desired output. The API validates the input against the schema before returning. No JSON parsing in the agent code; the SDK hands us a typed `block.input` object.

This pattern repeats across all three LLM stages. It's the single biggest reliability win in the codebase.

## The .env.local 401 story

The first live screening test 401'd. Anthropic returned `invalid x-api-key`. I knew the key was valid because the user had just pasted it.

Took 30 minutes of debugging to find: the user had run the password-hidden `read -s` command twice, and the second time accidentally pasted the verification `grep` command into the hidden prompt. The file now had:

```
ANTHROPIC_API_KEY=sk-ant-...real-key...
ANTHROPIC_API_KEY=grep -c "ANTHROPIC_API_KEY=sk-ant" .env.local
```

dotenv takes the *last* occurrence. So Next.js was passing the grep command string as the API key. Anthropic rejected it.

**Lesson for builders:** when an auth check fails, log the error type, not just the bare HTTP code. Anthropic returns `authentication_error` with a specific message — surface it to the developer immediately. The 30 minutes were spent looking for *my* bug; the error message named the right one all along.

## What lives in this stage's output

`{criteria: ScreeningCriterion[], results: ScreeningResult[]}`:
- `criteria` is currently always length 1 (the auto-generated one). The schema supports multiple.
- `results` is one entry per (paper, criterion). For 25 gathered papers × 1 criterion = 25 results.

Downstream extraction filters to papers where the decision was `"include"` or `"maybe"`. Excludes are dropped.

## Open questions

- **Editable criterion.** Added in Session 6: the search UI lets the user edit the criterion and trigger a re-screen. ~3 seconds, ~$0.02. The "auto-generated criterion is high quality but not always what the user wanted" UX gap was the most asked-for thing this pipeline solves.
- **Multiple criteria.** Schema supports it; UI doesn't. Each paper would get N decisions (one per criterion), and the "screen-in" rule becomes "passes all criteria." Natural extension of the editable-criterion UI.
- **Calibration.** Haiku's decisions look right by inspection, but I have no benchmark. If the model is silently dropping a class of relevant papers, I wouldn't know. A small eval set of ~50 questions with hand-picked target papers would let me measure recall directly.
- **Prompt caching at scale.** At 25 papers the system prompt + criterion is ~300 tokens — far below Haiku's 4096-token cache threshold. Caching does nothing. At 1000 papers, batching multiple papers per call (or bulking up the system prompt with examples) would let caching kick in and drop costs ~10x for the bulk of the calls.
