"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Search, Sparkles } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getStoredCorpus, type CorpusProvider } from "./CorpusToggle";

const EXAMPLE_QUERIES: string[] = [
  "What treatments are most effective for treatment-resistant depression?",
  "How does intermittent fasting affect insulin sensitivity?",
  "Which biomarkers best predict Alzheimer's disease progression?",
  "Does early bilingual exposure improve executive function in children?",
  "What molecular targets show promise for metastatic neuroendocrine prostate cancer?",
];

export function Hero() {
  const router = useRouter();
  const { show } = useToast();
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [corpus, setCorpus] = useState<CorpusProvider>("s2");

  useEffect(() => {
    setCorpus(getStoredCorpus());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<CorpusProvider>).detail;
      if (next === "s2" || next === "core") setCorpus(next);
    };
    window.addEventListener("evoke:corpus-change", onChange);
    return () => window.removeEventListener("evoke:corpus-change", onChange);
  }, []);

  const submit = async () => {
    const question = q.trim();
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, corpus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        show(body.error ?? "Failed to start search");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/report/${id}/gather`);
    } catch {
      show("Network error. Is the dev server running?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center text-text">
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12px] text-text-muted">
        <Sparkles size={12} className="text-text" />
        Research agent v1
      </div>
      <h1 className="mb-4 text-5xl font-semibold leading-tight tracking-tight text-text">
        Ready when you are.
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-base text-text-muted">
        Ask a research question — Evoke gathers, screens, extracts, and synthesizes
        sources into a structured report with citations you can trace.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-surface-muted px-5 py-3"
      >
        <Search size={18} className="flex-shrink-0 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything"
          className="flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
          disabled={submitting}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-text px-4 py-1.5 text-[13px] font-medium text-bg hover:bg-white disabled:opacity-50"
          disabled={!q.trim() || submitting}
        >
          {submitting ? "Searching…" : <>Start <ArrowRight size={14} /></>}
        </button>
      </form>

      <div className="mt-3 text-xs text-text-faint">
        Hits {corpus === "core" ? "CORE" : "Semantic Scholar"} live · gather → screen → extract → synthesize
      </div>

      <div className="mt-10">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-faint">
          Try an example
        </div>
        <ul className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2 text-left">
          {EXAMPLE_QUERIES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setQ(ex)}
                className="rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] text-text-muted transition-colors hover:bg-surface-muted hover:text-text disabled:opacity-60"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
