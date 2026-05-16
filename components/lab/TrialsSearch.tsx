"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Filter, Link as LinkIcon, Search, User } from "@/components/ui/Icon";
import type { Trial, TrialStatus } from "@/lib/trials";

// Real-time search against ClinicalTrials.gov v2. Mirrors the FindPapers
// layout so the visual rhythm of the Lab sidebar is consistent.
const STATUS_OPTIONS: Array<{ value: "" | TrialStatus; label: string }> = [
  { value: "", label: "Any status" },
  { value: "RECRUITING", label: "Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, not recruiting" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NOT_YET_RECRUITING", label: "Not yet recruiting" },
  { value: "TERMINATED", label: "Terminated" },
];

function statusLabel(status: TrialStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function statusTone(status: TrialStatus): string {
  if (status === "RECRUITING" || status === "ENROLLING_BY_INVITATION") {
    return "bg-[#1F6E68]/20 text-[#5FE3C6]";
  }
  if (status === "ACTIVE_NOT_RECRUITING") return "bg-[#3F3F3F] text-[#ECECEC]";
  if (status === "COMPLETED") return "bg-[#2F2F2F] text-[#B4B4B4]";
  if (status === "TERMINATED" || status === "WITHDRAWN" || status === "SUSPENDED") {
    return "bg-[#3A1F1F] text-[#FF6B6B]";
  }
  return "bg-[#2F2F2F] text-[#B4B4B4]";
}

export function TrialsSearch() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<"" | TrialStatus>("");
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const run = async (override?: string) => {
    const query = (override ?? q).trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setRan(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "25" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/lab/trials?${params.toString()}`);
      const body = (await res.json().catch(() => ({}))) as {
        trials?: Trial[];
        totalCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Trials search failed");
        setTrials([]);
        setTotalCount(undefined);
        return;
      }
      setTrials(body.trials ?? []);
      setTotalCount(body.totalCount);
    } catch {
      setError("Network error.");
      setTrials([]);
      setTotalCount(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQ.trim() && !ran) {
      void run(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-[#ECECEC]">Clinical trials</h1>
      <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-[#B4B4B4]">
        Live search against ClinicalTrials.gov. Returns NCT id, phases, conditions,
        interventions, sponsor, enrollment, and dates.
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. GLP-1 agonist heart failure"
          className="flex-1 bg-transparent text-[14px] text-[#ECECEC] outline-none placeholder:text-[#8E8E8E]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="rounded-full bg-[#ECECEC] px-4 py-1.5 text-[13px] font-medium text-[#0D0D0D] hover:bg-white disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mb-6 flex items-center gap-2 text-[12px] text-[#B4B4B4]">
        <Filter size={12} />
        <span>Status:</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | TrialStatus)}
          className="rounded-md bg-[#2A2A2A] px-2 py-1 text-[12px] text-[#ECECEC] outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-[#3A1F1F] px-4 py-3 text-sm text-[#FF6B6B]">{error}</div>
      )}

      {ran && !loading && !error && trials.length === 0 && (
        <div className="rounded-lg border border-[#3F3F3F] bg-[#2A2A2A] px-4 py-3 text-[13px] text-[#B4B4B4]">
          No trials found. Try rewording or loosening the status filter.
        </div>
      )}

      {trials.length > 0 && (
        <>
          <div className="mb-2 text-[12px] uppercase tracking-wider text-[#8E8E8E]">
            {trials.length}
            {totalCount && totalCount > trials.length ? ` of ${totalCount}` : ""} trial
            {trials.length === 1 ? "" : "s"}
          </div>
          <ul className="flex flex-col gap-2.5">
            {trials.map((t) => (
              <li
                key={t.nctId}
                className="rounded-xl border border-transparent bg-[#2A2A2A] px-4 py-4 transition-colors hover:bg-[#333333]"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug text-[#ECECEC]">{t.title}</h3>
                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(t.status)}`}
                  >
                    {statusLabel(t.status)}
                  </span>
                </div>
                <div className="mb-2 inline-flex flex-wrap items-center gap-2.5 text-[12px] text-[#B4B4B4]">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-[#2F2F2F] px-1.5 py-0.5 font-medium hover:text-[#ECECEC]"
                  >
                    <LinkIcon size={10} /> {t.nctId}
                  </a>
                  {t.phases.length > 0 && (
                    <span>{t.phases.map((p) => p.replace("PHASE", "Phase ").replace("EARLY_", "Early ")).join(", ")}</span>
                  )}
                  {t.studyType && <span>{t.studyType.toLowerCase()}</span>}
                  {t.enrollment != null && <span>n = {t.enrollment.toLocaleString()}</span>}
                  {(t.startDate || t.completionDate) && (
                    <span>
                      {t.startDate ?? "?"} – {t.completionDate ?? "?"}
                    </span>
                  )}
                </div>
                {t.sponsor && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-[#B4B4B4]">
                    <User size={12} /> {t.sponsor}
                  </div>
                )}
                {t.conditions.length > 0 && (
                  <div className="mb-1 text-[12.5px] text-[#ECECEC]">
                    <span className="text-[#8E8E8E]">Conditions: </span>
                    {t.conditions.slice(0, 6).join(" · ")}
                    {t.conditions.length > 6 ? ` +${t.conditions.length - 6}` : ""}
                  </div>
                )}
                {t.interventions.length > 0 && (
                  <div className="text-[12.5px] text-[#ECECEC]">
                    <span className="text-[#8E8E8E]">Interventions: </span>
                    {t.interventions.slice(0, 6).join(" · ")}
                    {t.interventions.length > 6 ? ` +${t.interventions.length - 6}` : ""}
                  </div>
                )}
                <div className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-[#B4B4B4]">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#ECECEC]"
                  >
                    Open on ClinicalTrials.gov <ExternalLink size={11} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
