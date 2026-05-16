// Persistent paper library. Saved across sessions via localStorage so the
// user can collect papers from search/extraction/chat views and revisit
// them on a dedicated /library page later.
//
// Schema is intentionally simple: a flat list of Paper objects plus a
// per-paper `savedAt` timestamp. Dedupe by `paper.id`. Browser-only —
// guards against SSR.

import type { Paper } from "@/lib/types";

const KEY = "evoke.library";
const EVENT = "evoke:library-change";

export type LibraryEntry = {
  paper: Paper;
  savedAt: string; // ISO timestamp
  source?: string; // optional human-readable origin ("Lennox-Gastaut run", etc.)
};

type Stored = { entries: LibraryEntry[] };

function read(): Stored {
  if (typeof window === "undefined") return { entries: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) return parsed as Stored;
    return { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function write(s: Stored) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getLibrary(): LibraryEntry[] {
  return read().entries;
}

export function isInLibrary(paperId: string): boolean {
  return read().entries.some((e) => e.paper.id === paperId);
}

/** Add papers to the library. Returns the number actually added (excluding dupes). */
export function addToLibrary(papers: Paper[], source?: string): number {
  const current = read();
  const existingIds = new Set(current.entries.map((e) => e.paper.id));
  const now = new Date().toISOString();
  let added = 0;
  for (const p of papers) {
    if (!p.id || existingIds.has(p.id)) continue;
    current.entries.push({ paper: p, savedAt: now, source });
    existingIds.add(p.id);
    added++;
  }
  if (added > 0) write(current);
  return added;
}

export function removeFromLibrary(paperId: string) {
  const current = read();
  const next = current.entries.filter((e) => e.paper.id !== paperId);
  if (next.length !== current.entries.length) write({ entries: next });
}

export function clearLibrary() {
  write({ entries: [] });
}

export function subscribeLibrary(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => cb();
  window.addEventListener(EVENT, onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
