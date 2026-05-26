import { AsyncLocalStorage } from "node:async_hooks";

// Per-request key store. API routes parse Anthropic / S2 keys out of headers
// and stash them here so deep callees (lib/anthropic.ts, lib/corpus/*) can
// read them without threading args through every signature.
//
// Falls back to process.env when the context is empty — keeps local CLI
// scripts (scripts/*.ts) and dev-without-UI flows working as before.

export type RequestKeys = {
  anthropicKey?: string;
  s2Key?: string;
};

const als = new AsyncLocalStorage<RequestKeys>();

export function runWithKeys<T>(keys: RequestKeys, fn: () => T): T {
  return als.run(keys, fn);
}

export function getRequestKeys(): RequestKeys {
  return als.getStore() ?? {};
}
