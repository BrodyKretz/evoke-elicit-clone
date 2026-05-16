# Decisions

Running log of choices made building Evoke. ADR-lite. Newest first.

---

## 2026-05-11 · Phase 2 plan locked in

**Sequencing.** End-to-end thin slice first, then iterate on the weakest stage. Considered (A) quality-first per-stage and (C) stage-by-stage demos; rejected both because the skeleton phase already proved that contracts between stages matter more than per-stage polish, and the iteration story will make a better writeup.

**Corpus.** Semantic Scholar API. 200M papers, free tier sufficient for development, has its own relevance ranking so we can defer building our own embedding index until quality iteration. OpenAlex left as a future fallback / corpus-dump option.

**LLM provider.** Claude API (Anthropic SDK). Stage-appropriate models: Haiku for screening (cheap, many calls), Sonnet for extraction, Opus for synthesis. Multi-provider abstraction deferred to phase 6+.

**Writeup cadence.** Per-session log appended to `docs/writeup/sessions/` after each build session, capturing what landed, what was surprising, and what to revisit. Section stubs in `docs/writeup/00-09` get folded in only when material is ready.

**Sessions roadmap.** S1 real gather (no LLM) · S2 screening · S3 extraction · S4 synthesis · S5 live progress · S6+ quality iteration. Each session is roughly a focused day.

---

## 2026-05-11 · Skeleton-first build, agent layer deferred

**Context.** Goal is a faithful Elicit clone scaling to 1,000-paper synthesis. The agent layer (retrieval + screening + extraction + synthesis) is the hard part and will dominate effort. The UI is the surface area where decisions cascade — every agent output needs a place to live.

**Decision.** Build the UI shell and data contracts first with mock data, then implement agents one stage at a time against fixed contracts.

**Why.** Two reasons:

1. **Forcing function for the data model.** Pretending we have outputs from agents forces us to define the type of those outputs. The TS types in `lib/types.ts` become the contract every agent must satisfy.
2. **Demoable in a day.** A clickable skeleton is a much better artifact for getting feedback than a half-built retrieval system.

**Trade-off.** We'll discover edge cases when real agent outputs hit the UI (long abstracts, missing fields, formatting drift in LLM tables) that the fixtures hide. We'll accept that and iterate.

---

## 2026-05-11 · Next.js (App Router) full-stack, Python agent service later

**Context.** Need a framework that handles a polished UI (tables, multi-view nav, eventual streaming) *and* gives us a path to the Python ML/agent code we'll need.

**Considered:**

- **A. Next.js + FastAPI from day one.** Two services, but Python is where agents naturally live.
- **B. Next.js full-stack, Python as a microservice when needed.** One repo, one process during skeleton phase.
- **C. Static HTML.** Fast demo, but throwaway.

**Decision.** B. Single Next.js codebase with mock API routes. Spin up a Python service later when we need it for embeddings/LLM calls.

**Why.** Skeleton has no Python need yet. A second service is a hidden tax (env management, deploy, IPC). The mock routes have the *same shape* the Python service will eventually serve, so the swap is mechanical.

---

## 2026-05-11 · Tailwind with custom design tokens (not shadcn/ui)

**Context.** The UI must match Elicit's distinctive cream/teal aesthetic — academic, calm, paper-leaning. Component libraries tend to push everything toward a generic shadcn look.

**Decision.** Tailwind + custom tokens (`bg`, `teal`, `surface-muted`, etc.) + Manrope/Fraunces fonts via `next/font/google`. Build primitives by hand.

**Why.** Visual identity is a moat for this kind of product. A retheme over shadcn primitives ends up being more work than just writing the primitives, given how few we actually need (table, button, toast, tab, sidebar).

---

## 2026-05-11 · Three seeded reports, each in a different pipeline state

**Context.** Need demo data. Could seed one full example or several thin ones.

**Decision.** Three reports — one complete, one stuck at search results, one mid-gather — so all three pipeline states are clickable without a real backend.

**Why.** The pipeline status sidebar is a key piece of the product story (Elicit shows progress prominently). Having three reports in different states means the sidebar tells a true story for each, instead of always showing "complete."

---

## Decisions still to make (phase 2)

- Paper corpus source: Semantic Scholar API vs OpenAlex dump vs scraped PDFs.
- Embedding model: bge-large vs OpenAI text-embedding-3-large vs nomic-embed-text.
- Re-ranking strategy: simple linear combination vs learned ranker.
- LLM(s) for screening/extraction/synthesis — different models per stage or one for all?
- Streaming protocol: SSE vs WebSocket vs Next.js Server Actions with progress.

---

## 2026-05-11 · Stage models (Sessions 2-4)

**Decision.** Different model per stage by cost profile: **Haiku 4.5 for screening** (high call volume, structured yes/no), **Sonnet 4.6 for extraction** (per-paper reasoning, ~$0.07 per 4 papers), **Opus 4.7 for synthesis** (one expensive cross-paper call, structural-output reliability matters most).

**Why.** Funnel-shaped pipelines need cost-shaped model choices. A single-model strategy either burns money on the front of the funnel (Opus everywhere) or sacrifices quality at the back (Haiku everywhere). Per-stage selection let total cost land at ~$0.15-0.25 per full run.

## 2026-05-11 · Forced tool use over `output_config.format` (Sessions 2-4)

**Decision.** Every agent uses `tool_choice: {type: "tool", name: "..."}` with a single forced tool whose `input_schema` is the desired output shape.

**Why.** Reliable structured output, type-checkable schemas, no JSON parsing in the agent. Same pattern works across all three agents.

**Trade-off discovered in Session 4.** Forced tool use is incompatible with `thinking: {type: "adaptive"}` on Opus 4.7 ("Thinking may not be enabled when tool_choice forces tool use"). Picked structural reliability over thinking depth — `effort: "high"` provides a partial substitute for the synthesis stage.

## 2026-05-11 · Background pipeline + SSE for progress (Session 5)

**Considered:**

- **A.** Synchronous POST returns when pipeline completes (~30-45s). Simple but UX nightmare.
- **B.** POST returns id immediately; background pipeline; SSE endpoint streams live events. Asynchronous.

**Decision.** B. Single Node process runs the pipeline; an in-memory `EventEmitter` per run is the bus; the SSE handler subscribes and forwards events to the client.

**Implementation gotcha.** Module-level Maps in Next.js dev mode are *not shared across route bundles* — each route can get its own copy of the module. Anchored the bus state to `globalThis.__evoke_runs` to force sharing. In production this might be a single bundle anyway, but the global-singleton pattern is the right shape for any multi-worker future.

## 2026-05-11 · Editable criterion + re-screen as the first quality iteration (Session 6)

**Considered:**

- Embedding-based re-ranking on top of S2 relevance.
- Per-cell source-span provenance in extraction.
- Editable screening criterion + targeted re-screen.

**Decision.** Editable criterion + re-screen. Most user-visible, least engineering effort, closes the most-asked-for feedback loop ("did the auto-generated criterion make sense?"). Other two deferred.

**Why.** The auto-generated criterion is high-quality but not always what the user wanted. Without an edit path, the only way to refine is to start a whole new run — burns the S2 quota and the synthesis budget. Re-screening reuses gathered papers and costs ~$0.02 per re-run.
