"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

// Two-state toggle for corpus provider. Persists choice to localStorage so it
// sticks across page navigations. Consumed by the Hero form via the same
// localStorage key.

export type CorpusProvider = "s2" | "core";
const STORAGE_KEY = "evoke.corpus";

export function getStoredCorpus(): CorpusProvider {
  if (typeof window === "undefined") return "s2";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "core" || raw === "s2" ? raw : "s2";
}

export function CorpusToggle() {
  const [corpus, setCorpus] = useState<CorpusProvider>("s2");

  // Hydrate from localStorage on mount. Avoids SSR/CSR mismatch.
  useEffect(() => {
    setCorpus(getStoredCorpus());
  }, []);

  const pick = (next: CorpusProvider) => {
    setCorpus(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    // Fire a synthetic event so other components in the page (the Hero form)
    // can react without a global state library.
    window.dispatchEvent(new CustomEvent("evoke:corpus-change", { detail: next }));
  };

  const opt = (key: CorpusProvider, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(key)}
      className={cn(
        "px-2.5 py-1 text-[12px] font-medium transition-colors",
        corpus === key
          ? "bg-text text-bg"
          : "bg-transparent text-text-muted hover:text-text"
      )}
      aria-pressed={corpus === key}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface p-0.5 text-[12px]">
      <span className="px-2 text-[11px] uppercase tracking-wider text-text-faint">
        Corpus
      </span>
      <div className="flex overflow-hidden rounded-full">
        {opt("s2", "Semantic Scholar")}
        {opt("core", "CORE")}
      </div>
    </div>
  );
}
