# Architecture overview

```
                            ┌──────────────┐
                research     │              │   ranked candidates (~25-1000)
                question  ──▶│  1. GATHER   │──────────────────┐
                            │ (S2 + rank)  │                  │
                            └──────────────┘                  ▼
                                                       ┌──────────────┐
                                                       │              │  yes/no decisions
                                                       │  2. SCREEN   │──────────────────┐
                                                       │   (Haiku)    │                  │
                                                       └──────────────┘                  ▼
                                                                                   ┌──────────────┐
                                                                                   │              │ structured fields
                                                                                   │  3. EXTRACT  │──────────────────┐
                                                                                   │   (Sonnet)   │                  │
                                                                                   └──────────────┘                  ▼
                                                                                                              ┌──────────────┐
                                                                                                              │              │ typed-block report
                                                                                                              │ 4. SYNTHESIZE│──────────▶ report
                                                                                                              │   (Opus 4.7) │
                                                                                                              └──────────────┘
```

Four stages, three Anthropic models, and one external API (Semantic Scholar for the corpus). The funnel shape is what makes this tractable: each stage is the *cheapest tool that does the job*, and the expensive ones (LLM-heavy) only touch the residue of the cheap ones (embedding-heavy).

## Why staged

Suppose you tried to do this as one big agent: "Here's a research question. Find me 30 relevant papers and write a literature review." That agent fails because:

- It can't see the corpus. Even with web search, ranking 10M papers by relevance per query is not what frontier LLMs are good at — embeddings are.
- It pays full LLM price for every paper it considers. Touching 1000 candidates with Opus to decide which to keep is $50+ per run.
- Failures cascade. A bad paper choice in the screening step propagates through extraction and synthesis with no opportunity to correct.

Splitting into four stages fixes each:

| Stage | Job | Best tool | Cost profile |
|---|---|---|---|
| Gather | Rank a huge corpus | Embeddings (or S2's relevance ranker) | Cheap; can touch all 10M |
| Screen | Per-paper yes/no | LLM (Haiku) | Cheap *per call*, many calls |
| Extract | Per-paper field-fill | LLM (Sonnet) | Moderate per call, fewer calls |
| Synthesize | Cross-paper narrative | LLM (Opus) | Expensive per call, one call |

The total cost ends up dominated by Sonnet extraction (~$0.07 for ~10 papers) and Opus synthesis (~$0.09). Per-run total: **~$0.15-0.25**. The cheap stages do the heavy lifting on volume; the expensive ones do the heavy lifting on quality.

## Data contracts between stages

Each stage produces a typed artifact that the next stage consumes. Concretely (in `lib/types.ts`):

```ts
type Paper = { id, title, authors, year, journal, citations, doi, abstract, ... };
type ScreeningResult = { paperId, criterionId, decision: "include"|"exclude"|"maybe", rationale };
type Extraction = { columns: string[], rows: { paper: Paper, cells: string[] }[] };
type ReportBlock = { kind: "paragraph"|"heading"|"sectionLabel"|"table"|"notes", ... };
type Report = { id, question, tldr, status, /* per-stage outputs */, ... };
```

Three implications:

- **Each stage is independently testable.** I wrote a per-agent smoke test (`scripts/test-{screening,extraction,synthesis}.ts`) that runs the agent against fixture data, bypassing the upstream stage. Crucial for cost-controlled iteration on prompts.
- **Each stage is independently re-runnable.** Session 6 added an "edit criterion + re-screen" flow that touches only stages 2-onwards, reusing the gather output. Same trick applies to re-running extraction against a different column set.
- **Each stage's failure is recoverable.** If extraction fails on one paper, only that row gets "Extraction failed"; the rest of the table is still useful. If synthesis fails, the user still has the extraction table.

This last property — partial-failure tolerance via typed intermediate artifacts — is the single most important architectural decision in the whole system.

## What's *not* an agent here

A useful comparison: Evoke is **not** built as a single agent with tools. The pipeline is code-orchestrated; each stage is a specific LLM call with a specific prompt and a specific schema. Agents (in the open-ended-tool-use sense) are reserved for stages where the model genuinely needs to choose what to do next.

I'd push back on calling this an "agentic system" in the popular sense — it's a *workflow* in the Anthropic taxonomy, not an agent. That's a feature, not a limitation: workflows are dramatically easier to evaluate, debug, and price.

If a future iteration wanted to add open-ended agent behavior, the natural place is *between* synthesis and the user: "Chat with this report" lets the model decide which tools to call against the run's extraction + screening data. That's also where Elicit's own product naturally extends.

## Stack at a glance

- **Frontend + backend:** Next.js 14 (App Router) in TypeScript. Single codebase, no separate Python service. The pipeline runs in the same Node process as the API routes — events stream via an in-memory bus and a SSE endpoint.
- **LLM provider:** Anthropic — Haiku 4.5 for screening, Sonnet 4.6 for extraction, Opus 4.7 for synthesis.
- **Corpus:** Semantic Scholar API. ~200M papers, free tier (with painful rate limits).
- **Persistence:** JSON file at `.evoke/runs.json`. Plenty for development; would swap for Postgres + pgvector at scale.
- **Live progress:** Server-Sent Events from the backend pipeline to a typed event listener in the gather view.

The rest of this writeup walks each stage individually with the specific design choices, the prompts, and the things that surprised me.
