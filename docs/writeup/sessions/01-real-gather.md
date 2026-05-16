# Session 1 — Real Gather (Semantic Scholar, no LLM)

**Date:** 2026-05-11
**Goal:** Typing a question on the home page returns real papers from Semantic Scholar — no LLM yet.

## What landed

- `lib/semantic-scholar.ts` — typed fetch client for S2's `/paper/search` endpoint. Maps the S2 schema to our `Paper` type. Optional API-key header via `SEMANTIC_SCHOLAR_API_KEY` env. Retry-with-exponential-backoff (1s, 2s, 4s) on 429 / 5xx.
- `lib/store.ts` — JSON-file persistence at `.evoke/runs.json`. `saveRun`, `getRun`, `listRuns`, `newRunId` (8-char prefix of `crypto.randomUUID()`). Gitignored.
- `lib/data/reports.ts` — now merges fixtures + store. `getReport(id)` checks fixtures first, then falls back to runs. Fixtures win on collision.
- `app/api/search/route.ts` — replaces mock; hits S2 with the user's query, returns `Paper[]`.
- `app/api/reports/route.ts` POST — generates an id, hits S2 inline, persists the run, returns `{id, status}`. Synchronous on purpose for this session; async/streaming arrives in Session 5.
- `components/home/Hero.tsx` — submits to `/api/reports`, redirects to `/report/[id]/search` on success. Disabled state + error toast wired up.

## What surprised me

- **Unauth S2 is more punitive than the docs let on.** Two POSTs in 10 seconds got my IP soft-banned for ~60 seconds — every retry within the window also returned 429, regardless of backoff length. The retry logic is correct but it can't save you from a soft-ban; you really do need to wait or get a key. Added a note to the README.
- **The data-loader refactor was painless.** Once `getReport` was `fixtures[id] ?? getRun(id)`, every existing page kept working without touching component code. The fixture-as-immutable-registry decision from Session 0 paid off here — the seeded reports never get muddled with user-created runs.
- **`crypto.randomUUID()` is built into Node now.** Was about to reach for a UUID package, then remembered Node 19+ has it on globalThis. Stayed at zero new deps.
- **JSON-file persistence with sync `readFileSync` per request is honestly fine at this scale.** Store reads are <1ms on a sub-100KB file. The "this is dirty, fix it later" instinct was wrong — it's fine until we need queries or concurrent writes, neither of which apply yet.

## What I'd do differently

- Should have written the API key onboarding into the README *before* testing. Got rate-limited, had to context-switch into "explain how to add a key" mid-build.
- The Hero now redirects to `/search`, but the search tab UI still shows the toolbar implying you can refine the query. The `initialView: "search"` for new runs is right, but the lack of LLM-generated summaries makes the results page look incomplete. Need to either generate a summary in the next session or change the empty-summary fallback.

## Open questions

- **Caching:** an identical question should hit cached S2 results, not re-query. Add a simple `{ queryHash → results }` map in `lib/store.ts` next session?
- **Question normalization:** S2 ranks "biomarkers in LGS" and "biomarkers in lennox-gastaut syndrome" differently. Should the API call do any rewriting? Probably defer to embedding-based retrieval in Session 6+.
- **The `summary` field in `Paper`:** currently undefined for real papers. The UI falls back to `abstract`. Acceptable for now, but Session 2 should think about whether the screening agent fills in summaries as a byproduct.
- **Fixture identity vs run identity:** the three seeded reports use stable string ids (`lennox-gastaut`, etc.). New runs use 8-char hex. That's fine, but worth making sure no fixture ever collides with a generated id. Currently safe by construction (hex vs slug).
