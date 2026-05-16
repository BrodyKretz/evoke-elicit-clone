# Takeaways for builders

Five things that crystallized while building Evoke. These all apply to anything that's "an agent over a pile of documents" — not just literature review.

## 1. Stage your pipeline by cost, not by neatness

The temptation when designing an agent is to give it the most powerful tools and let it figure it out. That's how you spend $50 per run on what should be a $0.20 run.

Instead, look at each piece of work in the pipeline and ask:
- *What's the cheapest tool that can do this job at the required accuracy?*

For Evoke:
- Ranking 200M papers? Embeddings (cheap, fast, accurate enough at this stage).
- Yes/no per paper against a written criterion? Haiku (the cheapest LLM, good enough at structured judgments).
- Field extraction from an abstract? Sonnet (more reasoning, but still cost-efficient per call).
- Cross-paper narrative synthesis with provenance? Opus (the most expensive call, but only one per run).

The result: gather + screen cost pennies; extract + synthesize cost tens of cents. Total per-run cost is dominated by exactly the stages where quality matters most. Get this allocation wrong and your unit economics break.

## 2. The data contract is the architecture

I spent more time on `lib/types.ts` than on any single agent. That investment paid off everywhere downstream.

Once `Paper`, `ScreeningResult`, `Extraction`, and `ReportBlock[]` had stable shapes, every agent's job became "produce data of this shape." Each agent could be:

- Tested in isolation against fixture data (no upstream dependency).
- Rebuilt with a different model without touching anything else.
- Resumed after a failure (the previous stage's artifact is already on disk).

The corollary: **typed blocks beat markdown** for any structured output the UI needs to manipulate. Markdown loses cell-level citation anchors and table structure. Forced tool use with a JSON-schema'd output gives you predictable structure the UI can render with hover popovers, filtering, and interactive affordances.

## 3. Make every agent's output inspectable in the UI

Research users won't trust a black box. Every screening decision needs a "why," every extracted cell needs a "from what part of the abstract," every paragraph in the report needs a "which papers support this."

In Evoke, the screening UI shows include/exclude/maybe badges with the LLM's rationale on hover. The extraction UI shows single-quoted phrases that came directly from the abstract. The report UI shows cite-count badges next to each paragraph. None of this is decorative — it's what makes the system *auditable*.

The pleasant side effect: making outputs inspectable also makes them debuggable. When the LLM gets a screening decision wrong, the rationale tells you why. When extraction returns "Insufficient data," you can verify that the abstract genuinely didn't say. The user-facing transparency and the developer-facing observability are the same affordance.

## 4. Mocks first, agents second

The skeleton phase of this build had the entire UI clicking through realistic mock data before a single LLM call was wired up. That phase revealed:

- Three places where my types were wrong (collapsed unions, missing fields).
- Two UI bugs in tables that wouldn't have surfaced under perfectly-shaped real data.
- One naming choice (`cites` as `number` vs `number[]`) that I deferred and would still defer.

All of these would have been more expensive to find with real LLM output, because each iteration would have cost a real LLM call and several seconds of wait time. Mock data is fast, free, and as wrong-shape as you let it be — which is exactly what makes it good at finding holes.

The lesson generalizes: any time the *integration* between stages is the risky part, build the integration with fixtures first. Don't add real LLM calls until the contract between stages is stable.

## 5. Background pipeline + streaming UX is non-negotiable past ~10 seconds

The full Evoke pipeline runs in 30-45 seconds (gather + screen + extract + synthesize). Asking the user to stare at a loading spinner that long is bad. The fix is two pieces:

- **POST returns immediately** with a run id; the pipeline runs async in the same Node process.
- **An SSE endpoint streams per-stage events** to the UI; the loading view shows what's happening right now.

The result: the user sees "Gathering sources… 25 found. Screening… 12 of 25. Extracting columns: Study Design / Population / Outcome…" — each milestone announced as it happens. Same total wait, completely different perceived experience.

The corollary: design your typed events alongside your pipeline. Per-stage start/done events, per-iteration progress events, and named outputs (criterion text, column list, TLDR) are all worth emitting. They become the user's window into what your agent is doing.

---

## What I'd recommend reading next

If you found this useful and want to build something similar, the order I'd recommend:

1. **Anthropic's "Building agents" guide.** Walks through the workflow vs agent decision tree.
2. **The Elicit team's [own writing on the system](https://elicit.com/blog).** The architectural principles overlap; their challenges at scale are real.
3. **The OpenPoke writeup** by Shlok (which inspired the style of this one). Different domain, same compositional approach to multi-stage agent design.

And browse `evoke/docs/writeup/sessions/` in this repo if you want the unfiltered "here's what surprised me each day" version of the build. They're rougher than this synthesis but probably more useful for the actual building.
