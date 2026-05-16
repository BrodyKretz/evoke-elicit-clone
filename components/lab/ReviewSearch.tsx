"use client";

import { useEffect, useState } from "react";
import type { Paper, ScreeningCriterion, ScreeningResult } from "@/lib/types";
import { Book, Check, Filter, Link as LinkIcon, Search, Sparkles, User } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getStoredCorpus, type CorpusProvider } from "@/components/home/CorpusToggle";
import { addToLibrary, getLibrary, subscribeLibrary } from "@/lib/library";
import { cn } from "@/lib/utils/cn";

// Lab > Systematic review. Hits /api/lab/review which fans out screening
// across the search results and returns each paper with its decision.
// Decisions are color-coded; include first, maybe in the middle, exclude
// at the bottom so the user can scan the include set quickly.

type Decision = "include" | "exclude" | "maybe";
const DECISION_ORDER: Decision[] = ["include", "maybe", "exclude"];

function decisionTone(d: Decision): string {
  if (d === "include") return "bg-[#1F6E68]/20 text-[#5FE3C6]";
  if (d === "maybe") return "bg-[#3F3A1F] text-[#FFE08E]";
  return "bg-[#3A1F1F] text-[#FF9F8E]";
}

function decisionLabel(d: Decision): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function ReviewSearch() {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [criterion, setCriterion] = useState("");
  const [corpus, setCorpus] = useState<CorpusProvider>("s2");
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [screening, setScreening] = useState<ScreeningResult[]>([]);
  const [usedCriterion, setUsedCriterion] = useState<ScreeningCriterion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getLibrary().map((e) => e.paper.id)));
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  useEffect(() => {
    setCorpus(getStoredCorpus());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<CorpusProvider>).detail;
      if (next === "s2" || next === "core") setCorpus(next);
    };
    window.addEventListener("evoke:corpus-change", onChange);
    return () => window.removeEventListener("evoke:corpus-change", onChange);
  }, []);

  const run = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setRan(true);
    setCorrectedQuery(null);
    setPapers([]);
    setScreening([]);
    setUsedCriterion(null);
    try {
      const res = await fetch("/api/lab/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          criterion: criterion.trim() || undefined,
          corpus,
          limit: 12,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        papers?: Paper[];
        screening?: ScreeningResult[];
        criterion?: ScreeningCriterion;
        correctedQuery?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Review failed");
        return;
      }
      setPapers(body.papers ?? []);
      setScreening(body.screening ?? []);
      setUsedCriterion(body.criterion ?? null);
      if (body.correctedQuery) setCorrectedQuery(body.correctedQuery);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const screeningById = new Map(screening.map((s) => [s.paperId, s]));
  const ordered = papers
    .map((p) => ({ paper: p, decision: screeningById.get(p.id) }))
    .sort((a, b) => {
      const ai = a.decision ? DECISION_ORDER.indexOf(a.decision.decision as Decision) : 99;
      const bi = b.decision ? DECISION_ORDER.indexOf(b.decision.decision as Decision) : 99;
      return ai - bi;
    });

  const includedCount = screening.filter((s) => s.decision === "include").length;

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-[#ECECEC]">Systematic review</h1>
      <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-[#B4B4B4]">
        Search + screen in one shot. Each paper is graded against your inclusion
        criterion (or one we auto-generate) so you only read what matters. 12
        papers per run — each triggers an LLM call.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mb-3 flex items-center gap-2 rounded-xl bg-[#2F2F2F] px-4 py-2.5 shadow-sm"
      >
        <Search size={16} className="flex-shrink-0 text-[#8E8E8E]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. SGLT2 inhibitors heart failure preserved ejection fraction"
          className="flex-1 bg-transparent text-[14px] text-[#ECECEC] outline-none placeholder:text-[#8E8E8E]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="rounded-full bg-[#ECECEC] px-4 py-1.5 text-[13px] font-medium text-[#0D0D0D] hover:bg-white disabled:opacity-50"
        >
          {loading ? "Screening…" : "Run review"}
        </button>
      </form>

      <div className="mb-6 rounded-xl bg-[#2A2A2A] p-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8E8E8E]">
          <Filter size={11} /> Inclusion criterion
          <span className="ml-1 normal-case tracking-normal text-[#6F6F6F]">
            (optional — leave blank to auto-generate)
          </span>
        </label>
        <textarea
          value={criterion}
          onChange={(e) => setCriterion(e.target.value)}
          placeholder="e.g. Studies enrolling adults ≥65 with HFpEF reporting CV-death or HF-hospitalization outcomes"
          rows={2}
          className="w-full resize-y rounded-md bg-transparent px-2 py-1.5 text-[13px] text-[#ECECEC] outline-none placeholder:text-[#6F6F6F]"
          disabled={loading}
        />
      </div>

      {correctedQuery && (
        <div className="mb-4 rounded-lg border border-[#E5E5E5] bg-[#2A2A2A] px-4 py-2 text-[13px] text-[#ECECEC]">
          Searched as: <span className="font-semibold">{correctedQuery}</span>{" "}
          <span className="text-[#8E8E8E]">(auto-corrected)</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-[#3A1F1F] px-4 py-3 text-sm text-[#FF6B6B]">{error}</div>
      )}

      {ran && !loading && !error && papers.length === 0 && (
        <div className="rounded-lg border border-[#3F3F3F] bg-[#2A2A2A] px-4 py-3 text-[13px] text-[#B4B4B4]">
          No papers found. Try rewording the query.
        </div>
      )}

      {usedCriterion && (
        <div className="mb-4 rounded-xl bg-[#1F6E68]/10 px-4 py-3">
          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#5FE3C6]">
            <Sparkles size={11} /> Criterion applied
            {!criterion.trim() && (
              <span className="ml-1 normal-case tracking-normal text-[#A0A0A0]">(auto-generated)</span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-[#ECECEC]">{usedCriterion.text}</p>
          <div className="mt-2 text-[11.5px] text-[#A0A0A0]">
            {includedCount} of {papers.length} included
          </div>
        </div>
      )}

      {papers.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {ordered.map(({ paper, decision }) => {
            const d = (decision?.decision ?? "maybe") as Decision;
            const isSaved = savedIds.has(paper.id);
            return (
              <li
                key={paper.id}
                className="rounded-xl bg-[#2A2A2A] px-4 py-4 transition-colors hover:bg-[#333333]"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug text-[#ECECEC]">
                    {paper.title}
                  </h3>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", decisionTone(d))}>
                      {decisionLabel(d)}
                    </span>
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1F6E68]/20 px-2 py-0.5 text-[11px] font-medium text-[#5FE3C6]">
                        <Check size={10} /> Saved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const added = addToLibrary([paper], "Review");
                          if (added > 0) show("Saved to library");
                          else show("Already in your library");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[#3F3F3F] px-2 py-0.5 text-[11px] font-medium text-[#B4B4B4] hover:border-[#ECECEC] hover:text-[#ECECEC]"
                      >
                        <Book size={10} /> Save
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 text-[13px] text-[#B4B4B4]">
                  <User size={12} />
                  {paper.authors.slice(0, 4).join(", ")}
                  {paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ""}
                </div>
                <div className="mb-2 inline-flex flex-wrap items-center gap-2.5 text-[12px] text-[#B4B4B4]">
                  <span className="inline-flex items-center gap-1">
                    <Book size={11} />
                    {paper.journal ? `${paper.journal} · ` : ""}
                    {paper.year || "n.d."}
                    {paper.citations != null ? ` · ${paper.citations} citations` : ""}
                  </span>
                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-[#2F2F2F] px-1.5 py-0.5 font-medium hover:text-[#ECECEC]"
                    >
                      <LinkIcon size={10} /> DOI
                    </a>
                  )}
                </div>
                {decision?.rationale && (
                  <p className="rounded-md bg-[#1F1F1F] px-3 py-2 text-[12.5px] leading-relaxed text-[#ECECEC]">
                    <span className="text-[#8E8E8E]">Rationale: </span>
                    {decision.rationale}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
