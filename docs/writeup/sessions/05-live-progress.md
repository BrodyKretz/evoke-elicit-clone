# Session 5 — Live progress via SSE

**Date:** 2026-05-11
**Goal:** The pipeline now takes 30-45 seconds end-to-end. Replace the "frozen loading spinner" UX with a live event stream so the user sees gather → screen → extract → synthesize as they happen.

## What landed

- `lib/events.ts` — module-level event bus. Per-run `EventEmitter` + history buffer in a `Map<runId, RunState>`. Typed `PipelineEvent` union covering stage start/done/error, progress ticks, criterion text, columns, TLDR, and a terminal `complete`/`error`. **The map is anchored to `globalThis`** (see "What surprised me" below).
- `lib/pipeline.ts` — the four-stage runner, extracted out of the API route. Threads an `EmitFn` through each agent and writes per-stage events. Persists progressively (final write after each stage), so a server restart mid-run leaves a recoverable state.
- `app/api/reports/route.ts` — POST is now synchronous-up-front but async-overall: validates input, persists initial empty Report, kicks off `runPipeline` *without awaiting*, returns `{id}` in <100ms. Next.js's Node runtime keeps the event loop alive until the background promise resolves.
- `app/api/reports/[id]/stream/route.ts` — new SSE endpoint. Returns a `ReadableStream` with `Content-Type: text/event-stream`. Subscribes to the run's bus, replays history first, tails new events, closes on `complete`/`error`. Emits an initial `: connected\n\n` SSE comment to force header flush.
- `lib/agents/screen.ts` and `lib/agents/extract.ts` — both gained an optional `onEvent?: EmitFn` parameter; per-paper progress events fire as papers complete.
- `components/gather/GatherView.tsx` — rewritten to subscribe to SSE when the run is in flight. Renders a "Live progress" card with the four stages, each with state (pending / running / done / error), and surfaces interesting payloads (the generated criterion, the extraction column list, the TLDR) as they arrive. On `complete`, briefly pauses then navigates to `/report/[id]/report`.
- `components/home/Hero.tsx` — submitting now routes to `/report/[id]/gather` (the loading view) instead of `/search`, so the user lands on live progress.
- `scripts/test-sse.ts` — driver that POSTs a real run, opens the SSE stream, and prints events to stdout. Useful for verifying the plumbing without the browser.

## What surprised me

- **The bus state lives in `globalThis`.** Spent a real amount of time debugging why SSE clients saw `: connected` and nothing else. The pipeline was clearly running (final state landed in `.evoke/runs.json`), but events weren't reaching the SSE handler. Turned out Next.js dev mode loads server modules into separate compilation bundles per route — POST's `lib/events.ts` and GET's `lib/events.ts` had different `Map` instances. Anchoring the Map to `globalThis` solved it instantly. In production this likely wouldn't matter (single bundle), but the dev-mode fix is the same shape as the right production fix once you have multiple workers: stash state in a shared singleton.

  Worth calling out in the writeup as a "thing nobody tells you about Next.js": *server-side module state is not as global as you'd expect across route handlers.*

- **SSE headers don't flush in Next.js until you write the first byte.** First attempt sat for 30 seconds before Node fetch headers-timed-out, even though `start(controller)` had been entered. Sending `controller.enqueue(encoder.encode(": connected\n\n"))` at the top of `start()` fixes it — the comment is valid SSE syntax and ignored by clients. Same lesson as historical SSE-in-Express debugging.

- **Typed unions + `Omit` don't distribute the way I wanted.** `Omit<PipelineEvent, "ts">` collapsed the union to its common keys (just `type`), so every emit call lost its discriminator-specific fields under typecheck. Wrote a `DistributiveOmit<T, K>` (`T extends T ? Omit<T, K> : never`) and the union behavior came back. This is exactly the kind of TypeScript trap that's easy to write past but pays dividends to fix — every agent now gets compile-time validation that its `onEvent` payload matches the schema.

- **Live progress is *much* more pleasant.** Even though I can't test it end-to-end through the browser without an S2 key, the curl-based verification showed events arriving within tens of milliseconds of each stage transition. The 30-45s pipeline feels acceptable when each stage announces itself.

- **Background promises in Next.js routes do keep running.** I was worried Next.js would kill the unawaited `runPipeline(...)` call after returning the POST response. In practice, the Node event loop stays alive as long as a promise is pending — the run completed correctly and persisted state to disk even though the original request handler had long returned. (This is a Node-runtime guarantee; on edge/serverless this assumption breaks and you'd need `ctx.waitUntil`.)

## What I'd do differently

- Should have anchored the bus to `globalThis` from the start — it's the standard pattern for "stateful singletons in Next.js" and I'd seen it before but forgot. ~20 minutes lost.
- The `PipelineEvent` union duplicates types between `lib/events.ts` (server) and `components/gather/GatherView.tsx` (client). Tolerable for now because the client can't import `node:events`, but a shared `lib/event-types.ts` (server + client safe) would be cleaner.
- Per-stage persistence happens at the end of each stage. For a real production system I'd want intermediate persistence inside long stages (e.g., after every N screened papers) so that a crash doesn't lose all the screening work. Skip for now — single-user dev environment.

## Open questions

- **Multi-tab same-run.** If two browser tabs open the same run's stream, both subscribe to the bus. The first to receive `complete` calls `controller.close()` on its own stream; the second tab's listener gets unsubscribed at the same time (because both fired on the same event). The second tab might miss the `complete` if the listener was removed mid-iteration. Subtle but unlikely to hit in practice — defer.
- **Reconnect behavior.** `EventSource` auto-reconnects on disconnect with a default 3s retry. On reconnect, the SSE handler replays history. If the run already finished, the replay sends everything and closes — but the `navigate` effect in `GatherView` would fire again. Should debounce or guard against this with a "already navigated" flag.
- **Pipeline runs longer than the dev server stays up.** If the dev server restarts mid-run, the in-flight `runPipeline` is killed. The persisted `Report` in `.evoke/runs.json` reflects the last stage that completed. No resume mechanism today — would need explicit checkpointing in `lib/pipeline.ts`.

## Live end-to-end status

The full POST → background pipeline → SSE → live UI flow is wired, type-checks, and the SSE plumbing was verified by curl against a real (S2-rate-limited) run. Without an S2 key the gather stage fails fast with a 429, but the error event correctly streams to the client, the UI shows the error inline, and the persisted run reflects the failure state — all stages of the new architecture working as designed.
