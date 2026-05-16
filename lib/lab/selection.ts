// Client-side store for the Lab's "selected papers" set. Persisted to
// localStorage so the selection survives navigation between Find / Chat /
// Extract. Browser-only — guards against SSR.

import type { Paper } from "@/lib/types";

const KEY = "evoke.lab.selection";
const EVENT = "evoke:lab-selection-change";

function readRaw(): Paper[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Paper[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(papers: Paper[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(papers));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getSelectedPapers(): Paper[] {
  return readRaw();
}

export function isSelected(id: string): boolean {
  return readRaw().some((p) => p.id === id);
}

export function toggleSelected(paper: Paper) {
  const current = readRaw();
  const idx = current.findIndex((p) => p.id === paper.id);
  if (idx === -1) {
    writeRaw([...current, paper]);
  } else {
    writeRaw(current.filter((p) => p.id !== paper.id));
  }
}

export function clearSelection() {
  writeRaw([]);
}

export function subscribeSelection(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  // Also sync across tabs.
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
