# Session 6 — Editable screening criterion (quality iteration)

**Date:** 2026-05-11
**Goal:** Most user-visible improvement to the pipeline: let the user see the auto-generated screening criterion, refine it, and re-screen without re-running gather.

## What landed

- `app/api/reports/[id]/rescreen/route.ts` — new POST endpoint. Takes `{criterion}` body, validates the run is a user-created run (not a seeded fixture), re-runs screening on the existing `gatheredSources` papers, persists the new screening with downstream stages marked stale. Returns counts so the UI can show a toast.
- `components/search/SearchView.tsx` — criterion card now has an "Edit & re-screen" button on user-created runs. Clicking it swaps the text for a textarea + Apply / Cancel controls. Apply hits the new endpoint, refreshes the route, badges update in place.
- Fixtures are intentionally read-only — the editable check is `/^[0-9a-f]+$/i.test(report.id) && report.id.length <= 10`, which matches the 8-char hex run ids and excludes the slug-based fixtures.

## What surprised me

- **The hardest part of "editable criterion" was the invalidation semantics, not the UI.** When the user re-screens, the existing extraction is now over a *different* set of "screened in" papers — extracting against a stale criterion is misleading. I chose to drop extraction + synthesized report entirely on re-screen and reset `initialView` to `"search"`. The user now lands back on the search results with the new badges and has to consciously decide to re-trigger downstream stages. Trade-off: more clicks, but no risk of stale-looking-fresh data.
- **`router.refresh()` is exactly the right tool here.** Server components re-fetch their data, the SearchView re-renders with the new screening, no manual state shuffling. I considered passing the updated screening through optimistic state in the client — `router.refresh()` is cheaper and more correct.
- **Fixtures vs user runs need a real type discriminator.** Right now the id-shape check (`/^[0-9a-f]+$/` for hex) is doing double duty as a "is this editable" flag. That's fragile. A cleaner version would have an explicit `kind: "fixture" | "user"` field on `Report`. Defer until something actually breaks.

## What I'd do differently

- "Reset extraction + report" is shown in the UI as a passive note. It would be friendlier to confirm explicitly ("This will replace the existing report") before the destructive update fires. Currently you can lose a 20-second synthesis output with one click. Could surface this as a modal in a future polish pass.
- The endpoint is synchronous (waits for ~25 Haiku calls) rather than using the SSE pipeline. ~3-5 seconds blocking, which is acceptable; promoting it to SSE would let me show per-paper screening progress in real time. Defer until the synchronous version proves slow in practice.
- The criterion is tied to the run id, but we don't version it — re-screening replaces the previous criterion + decisions wholesale. For a real product you'd want to keep history, A/B compare two criteria, and let the user revert. Out of scope for the skeleton.

## Open questions

- **Auto-cascade vs explicit rerun.** Right now after re-screen the user has to manually trigger extraction + synthesis again. Should re-screen kick off the rest of the pipeline automatically? Probably yes for most users, with a "criterion only" mode for the deliberate edge case. Defer.
- **Multiple criteria.** The data model supports a `criteria: ScreeningCriterion[]` array — I'm using just one. Letting the user add criteria (each a separate yes/no judgment per paper) is the natural next step. The screening UI would extend to a matrix view (papers × criteria) and the inclusion rule becomes "passes all criteria." Out of scope; flagged in Session 2's log too.

## End-of-build status

The pipeline is now editable mid-stream: users can refine the auto-generated criterion and see screening update in seconds, without paying for another gather + extract + synthesize cycle. This closes one of the most valuable feedback loops in the product — the "did the auto-generated criterion make sense?" check the user always wants to do after their first run.
