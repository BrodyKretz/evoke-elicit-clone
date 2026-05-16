# Where Evoke falls short

A clone's value depends on being honest about where it lands short of the thing it's cloning, and where the design itself has unsolved problems. Here are the real ones, in roughly decreasing order of severity.

## Real limitations

### 1. The corpus is Semantic Scholar API only

Elicit's corpus is broader and freshness-managed: indexing pipelines that ingest new arXiv preprints, full-text PDFs where they can be acquired, and citation graph updates that propagate quickly. Evoke punts to Semantic Scholar's public API and gets:

- ~200M papers — comprehensive for established literature, weaker on the freshest preprints.
- Abstracts only — no full text, even when freely available.
- An unauthenticated tier so aggressive about rate limiting that we couldn't drive a full end-to-end live demo through Sessions 1-5 without breaking. **A Semantic Scholar API key is functionally required for development cadence.** It's free, but it's a hurdle.

Adding OpenAlex as a second corpus + a local PDF cache for full-text extraction would close most of this gap. Out of scope for the skeleton.

### 2. Abstract-only extraction caps quality

The extraction agent reads each paper's abstract and pulls structured fields. Many of the most useful fields (exact sample size, statistical power, primary outcome's effect size and confidence interval) are usually in the paper body, not the abstract. Evoke labels these "Insufficient data" / "Not reported in abstract" honestly, but that's not the same as having the data.

A real version needs:
- Open-access PDF acquisition (Unpaywall API for OA links).
- PDF-to-text extraction (Anthropic's vision capabilities work surprisingly well here).
- Chunking + retrieval over the full paper instead of one-shot abstract input.

This is the single biggest quality lever. The skeleton doesn't pull it.

### 3. No real evaluation

I never built a benchmark. There's no "we ran 50 questions where the right answer is known and measured how often Evoke's top-30 included the true relevant papers." Without that loop:

- The screening criterion auto-generator could be drifting toward unhelpful criteria and I wouldn't know.
- The extraction columns could be missing the dimensions a domain expert would have picked.
- The synthesis report could be misweighting which findings to emphasize.

Elicit definitely runs eval at scale. I didn't. Any production deployment needs at least a small benchmark (~50 questions across a few domains, scored against domain-expert lit-review choices) and a cost-per-run vs. quality-on-eval frontier to tune against.

### 4. The 1000-paper claim is aspirational here

Elicit's marketing claims "we analyze up to 1,000 papers" — meaning the screening LLM looks at the top-1000 after retrieval ranking. Evoke currently gathers 25. The architecture supports the bigger number (the LLM calls would just take longer; cost would be ~$3-5 per run with screening at 1000-paper scale), but I haven't proved it out and the rate limits would bite hard.

To actually hit 1000:
- Need an S2 API key.
- Need to bump the screening concurrency and accept the longer wall-clock (or use Anthropic Batch API).
- Prompt caching becomes genuinely valuable at that scale — system prompt + criterion can stay cached across 1000 paper-specific calls. Currently below cache thresholds.

### 5. No "Chat with this report" interface — *next to build*

Elicit's most compelling post-synthesis feature is an open-ended chat over the report and underlying data. "Why was paper X excluded? Add it back." "Compare the methodology between the two RCTs." That's where a real agentic loop earns its keep — the user's questions are open-ended and the model decides which tools to call against the run's data.

The Evoke UI has a chat-card placeholder in the sidebar but the backend isn't wired yet. Spec for the next session:

- **Scope-bounded.** Chat only answers from the current run's screening + extraction + synthesized report + paper abstracts. Does not draw on broader knowledge. Evidence-based responses, like Elicit's version.
- **Capabilities.** Compare findings across papers; explain methodology, outcomes, and conclusions; synthesize across studies; help the user understand the report. Plus light platform-navigation help ("press 'edit columns' to add fields").
- **Architecture.** `POST /api/reports/[id]/chat` taking `{messages, userMessage}`; backend builds a system prompt from the run's data; streams Opus response via SSE. UI replaces the sidebar chat-card placeholder with a real message thread.
- **No S2 dependency.** Operates on any completed run, including the seeded fixtures — buildable today.

Worth roughly one focused session. Promoted from "out of scope" to "next to build" after the user explicitly named it as a target feature.

## Unsolved design problems

### Per-cell provenance is fake

The extraction cells include single-quoted phrases as "evidence." That's a UI convention, not a real provenance link. The "right" version is:

```ts
type Cell = {
  value: string;
  sourceSpan: { paperId: string; quote: string; charOffset?: number };
};
```

…with the UI rendering hover popovers that highlight the source phrase in the paper text. Adding this requires:
- Extracting `sourceSpan` from the LLM as part of the extraction tool call (probably feasible).
- Storing the paper's abstract text alongside (already done).
- Building the popover UI.

Not architecturally hard, but a real chunk of work. Flagged.

### Cite counts vs. cite arrays

In the synthesized report, paragraphs carry `cites: number` — just a count. The "right" version is `cites: number[]`, where the values are paper indices into `references`. That lets the cite markers be clickable and the popovers show *which* papers support each claim.

Again, additive change: the synthesis prompt needs to emit indices instead of counts, the type widens, the cite component renders linked markers. Real but bounded work.

### Re-running just one stage

The "Edit & re-screen" flow added in Session 6 only works for screening. Editing extraction columns (or adding new ones) after a run finishes would need a similar endpoint. So would re-running synthesis with a different style ("make it shorter," "emphasize methodology"). The architecture supports it; the UI doesn't yet.

### State persistence is JSON file

`.evoke/runs.json` is fine for a single-user development environment. For anything multi-user, multi-process, or restartable:
- Need a real database (SQLite is enough for single-server; Postgres + pgvector when scaling).
- Need to persist in-flight pipeline progress (so a server restart can resume).
- Need a job queue (BullMQ or similar) instead of "kick off an unawaited promise."

The architecture is friendly to this swap — `lib/store.ts` is a thin file-based implementation behind a small API surface — but the swap itself is unstarted.

### Schema for chat interactions

If/when "chat with this report" lands, the agent needs tools that read the run's screening + extraction + paper data. Designing those tools (and the agent loop that calls them) is its own design exercise, ducked here.

## What I'd build first if I had another two weeks

1. Get a Semantic Scholar API key and a PDF cache so the corpus side actually works.
2. Build a small eval benchmark (~30 questions with hand-picked target papers).
3. Tune prompts against the eval until each stage is at "trusted enough to ship internally."
4. Wire per-cell provenance + cite arrays so the UI is actually citation-anchored.
5. Add "Chat with this report" as the demo-worthy moat.

In that order. The further down the list, the easier each item gets — the early ones unlock everything that follows.
