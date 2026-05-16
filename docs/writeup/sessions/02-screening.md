# Session 2 — Screening agent (one criterion, top-N papers)

**Date:** 2026-05-11
**Goal:** After gather, auto-generate one inclusion criterion from the question and screen every returned paper against it. Decisions render inline in the Search Results view.

## What landed

- `@anthropic-ai/sdk` added (`^0.40.1`). One new dependency, well-known.
- `lib/anthropic.ts` — singleton client + `MODELS` map. Throws fast if `ANTHROPIC_API_KEY` is missing.
- `lib/types.ts` updated:
  - `ScreeningCriterion` → `{id, text}` (was incorrectly conflated with decision in Session 0)
  - New `ScreeningResult` and `Screening` types (per-(paper, criterion) record)
  - `Report.screening?` field added
- `lib/agents/screen.ts`:
  - `generateCriterion(question)` — one Haiku call, forced tool use returns the criterion as structured JSON
  - `screenPaper(paper, criterion, question)` — one Haiku call per paper, forced `record_decision` tool returns `{decision, rationale}`
  - `screenPapers(...)` — bounded-parallelism (concurrency=3) wrapper. Per-paper failures logged and skipped, not fatal
  - Tiny `pMap` helper for bounded parallel — didn't need a dep just for this
- `app/api/reports/route.ts` POST now chains gather → criterion → screen. Failures at each stage are caught and surfaced via the run's `tldr`.
- `components/search/SearchView.tsx` extended:
  - Criterion shown as a teal-tinted card above results, with include/maybe/exclude/all filter pills + counts
  - Each paper gets a status badge (Included / Maybe / Excluded) with the rationale as a `title` tooltip
  - Excluded papers dimmed but visible
  - Rationale also rendered as italic text below the summary so it's discoverable without hover
- `scripts/test-screening.ts` — smoke test runs the agent against the prostate-cancer fixture without S2 in the loop. Bypasses rate limits and gives quick feedback on prompt quality.

## What surprised me

- **The auto-generated criterion is *really* good.** Test run on the prostate cancer fixture produced:
  > "The paper investigates molecular targets or therapeutic interventions for treating metastatic neuroendocrine prostate cancer in patients with resistance or progression after androgen deprivation therapy."

  That's a tightly-scoped, gradeable criterion. Haiku at $1/MTok handled it in ~600ms. I was prepared to need Sonnet for criterion gen and was wrong.
- **Decisions are reliably reasoned.** Of the 4 fixture papers: 2 INCLUDE (directly relevant), 1 EXCLUDE (focused on regular prostate adenocarcinoma, not NEPC), 1 MAYBE (AIPC paper that doesn't confirm NEPC subtype). Every rationale cited a specific aspect of the abstract.
- **Forced tool use is the right call for structured output here.** No JSON-parsing flakiness across 25+ calls. The skill recommended this and it Just Worked.
- **`.env.local` parsing has a sharp edge.** First attempt 401'd because the file had two `ANTHROPIC_API_KEY=` lines — the second one was a stray paste of the verification `grep` command from earlier. dotenv takes the *last* occurrence, so the junk line silently won. Lesson: write defensively against duplicate env keys, and surface clearly when an auth check fails (Anthropic returns 401 with a specific message, but our code only logged the bare error). Worth adding a startup sanity check that calls `models.retrieve()` once to fail loudly if the key is bad.
- **Semantic Scholar's unauth soft-ban is *persistent*.** Once you trip 429, the soft-ban appears to last on the order of minutes, not the documented seconds. Multiple attempts spaced 60-90s apart still 429'd. The retry-with-backoff in our S2 client is correct but can't out-wait the ban. For development at any reasonable iteration speed, an S2 API key is functionally required.
- **The isolated test script paid for itself immediately.** When the full pipeline kept 429ing on S2, having `scripts/test-screening.ts` meant I could still verify the screening logic end-to-end without S2 in the loop. Worth keeping the pattern: each agent should have a small driver script that runs it against a fixture.

## What I'd do differently

- Should have added the .env duplicate-key cleanup automatically the first time I noticed the user might have entered it twice, instead of just offering an optional cleanup command. The 401 cost ~30 minutes of debugging that wouldn't have happened with one extra `grep | mv`.
- The POST endpoint is now synchronous through gather + screen. Total time = ~3s (gather) + ~600ms (criterion) + ~2-3s (25 papers screened at concurrency=3) = ~6-8s. UX is "Start" button stuck on "Searching…" the whole time. Fine for now, but the next stage (extraction) will be longer and we'll need progress feedback. Tempted to fast-forward Session 5 (SSE) before Session 3 (extraction) for that reason — but sticking to the plan.
- `screenPaper` doesn't include the paper year or journal in the prompt. For some research questions, recency or venue would be relevant signals. Defer to the quality iteration in Session 6+.

## Open questions

- **Should there be a "rerun screening" path?** Right now the criterion is auto-generated and immutable. If the user wants to add or edit criteria, we'd need an endpoint that takes `{criterion}` and re-screens. Easy to add — defer until needed.
- **Caching strategy when we scale.** At the 25-paper scale the system prompt + criterion is ~300 tokens — far below Haiku's 4096-token cache threshold, so no cache benefit. At 1000 papers we'd absolutely want caching. Options when we get there: (a) bulk up the prompt with examples, (b) switch screening to Sonnet (lower threshold), (c) batch screening (multiple papers per call) which dodges the issue entirely.
- **Multiple criteria.** The data model supports it (`criteria: ScreeningCriterion[]`), but the UI only renders one. When we add criterion editing, this needs to extend to a matrix view (papers × criteria).
- **Excluded papers in downstream stages.** Right now the run carries all 25 papers in `searchResults`. Extraction and synthesis (Sessions 3-4) should probably operate on only the *included* + *maybe* set, not all 25. Need a small helper that selects screened-in papers for downstream stages.
