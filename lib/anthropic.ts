import Anthropic from "@anthropic-ai/sdk";

// Singleton client. Reads ANTHROPIC_API_KEY from the environment (loaded from
// .env.local by Next.js). Throws at first use if the key is missing — failing
// fast is better than emitting cryptic 401s deep in a pipeline.
let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY missing from environment. Add it to .env.local."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// Model IDs surfaced once so the rest of the codebase picks them by purpose
// rather than hard-coding strings. Haiku is the workhorse for high-volume,
// low-judgment tasks (screening); Sonnet/Opus reserved for harder stages later.
export const MODELS = {
  screening: "claude-haiku-4-5",
  extraction: "claude-sonnet-4-6",
  synthesis: "claude-opus-4-7",
} as const;
