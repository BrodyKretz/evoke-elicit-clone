// Module-level event bus for in-flight pipeline runs.
//
// Design: each run gets its own EventEmitter + history buffer. The pipeline
// (running async after POST returns) emits events; the SSE handler subscribes.
// History buffer lets late subscribers replay everything that already happened.
//
// In-memory only. A server restart loses in-flight state. Acceptable for now —
// the persisted run in `.evoke/runs.json` is the durable copy at completion.

import { EventEmitter } from "node:events";

export type PipelineStage = "gather" | "screen" | "extract" | "synthesize";

export type PipelineEvent =
  | { type: "stage.start"; stage: PipelineStage; ts: number }
  | { type: "stage.done"; stage: PipelineStage; data?: Record<string, unknown>; ts: number }
  | { type: "stage.error"; stage: PipelineStage; error: string; ts: number }
  | { type: "criterion"; text: string; ts: number }
  | { type: "columns"; columns: string[]; ts: number }
  | { type: "progress"; stage: "screen" | "extract"; done: number; total: number; ts: number }
  | { type: "tldr"; text: string; ts: number }
  | { type: "agent.iteration"; n: number; ts: number }
  | { type: "agent.thought"; text: string; ts: number }
  | { type: "agent.tool_call"; name: string; input: Record<string, unknown>; ts: number }
  | { type: "agent.tool_result"; name: string; summary: string; ts: number }
  | { type: "agent.working_set"; total: number; added: number; ts: number }
  | {
      type: "agent.finalize";
      answer: string;
      citedIds: string[];
      citedPapers: Array<{
        id: string;
        title: string;
        authors: string[];
        year: number;
        doi?: string;
      }>;
      ts: number;
    }
  | { type: "complete"; ts: number }
  | { type: "error"; error: string; ts: number };

type RunState = {
  bus: EventEmitter;
  history: PipelineEvent[];
  closed: boolean;
};

// Persist the Map across hot reloads / multiple module evaluations in dev.
// Without this, two route handlers can each load a fresh `lib/events.ts`
// module instance with its own (empty) Map and never see each other's events.
const g = globalThis as unknown as { __evoke_runs?: Map<string, RunState> };
const runs = g.__evoke_runs ?? new Map<string, RunState>();
g.__evoke_runs = runs;

function getOrCreate(runId: string): RunState {
  let state = runs.get(runId);
  if (!state) {
    state = { bus: new EventEmitter(), history: [], closed: false };
    state.bus.setMaxListeners(50); // multiple SSE subscribers possible
    runs.set(runId, state);
  }
  return state;
}

// Distributive Omit so each union member loses `ts` while keeping its own
// discriminator + extra fields. Plain Omit<Union, K> narrows to common keys.
type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never;
type PipelineEventInput = DistributiveOmit<PipelineEvent, "ts">;

export function emit(runId: string, event: PipelineEventInput) {
  const state = getOrCreate(runId);
  if (state.closed) return;
  const full = { ...event, ts: Date.now() } as PipelineEvent;
  state.history.push(full);
  state.bus.emit("event", full);
  if (full.type === "complete" || full.type === "error") {
    state.closed = true;
    // Defer cleanup so late subscribers can still replay history briefly.
    setTimeout(() => runs.delete(runId), 5 * 60 * 1000);
  }
}

export function subscribe(
  runId: string,
  onEvent: (e: PipelineEvent) => void
): { unsubscribe: () => void; history: PipelineEvent[]; closed: boolean } {
  const state = getOrCreate(runId);
  state.bus.on("event", onEvent);
  return {
    history: [...state.history],
    closed: state.closed,
    unsubscribe: () => state.bus.off("event", onEvent),
  };
}

// Convenience callback shape that gets threaded through agent functions.
export type EmitFn = (event: PipelineEventInput) => void;

export function makeEmitter(runId: string): EmitFn {
  return (event) => emit(runId, event);
}
