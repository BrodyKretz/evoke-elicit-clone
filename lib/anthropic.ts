import Anthropic from "@anthropic-ai/sdk";
import { getRequestKeys } from "./request-context";

// Per-request client. Prefers a user-supplied key from the request context
// (visitor pasted their key in the BYO settings modal → header → ALS); falls
// back to process.env for local CLI scripts and dev-without-UI flows.
//
// Not cached — caching would couple two requests with different keys.
export function anthropic(): Anthropic {
  const apiKey = getRequestKeys().anthropicKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Anthropic API key missing. Add it via the in-app settings menu, or set ANTHROPIC_API_KEY in .env.local for local dev."
    );
  }
  return new Anthropic({ apiKey });
}

// Model IDs surfaced once so the rest of the codebase picks them by purpose
// rather than hard-coding strings. Haiku is the workhorse for high-volume,
// low-judgment tasks (screening); Sonnet/Opus reserved for harder stages later.
export const MODELS = {
  screening: "claude-haiku-4-5",
  extraction: "claude-sonnet-4-6",
  synthesis: "claude-opus-4-7",
} as const;
