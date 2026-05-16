import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { ExampleReportCard } from "@/components/home/ExampleReportCard";
import { CorpusToggle } from "@/components/home/CorpusToggle";
import { listReports } from "@/lib/data/reports";

// /research-agent/v1 — the previous dark Hero + example reports + pipeline
// diagram. Kept around as the "v1" version, surfaced via a pill on the
// current /research-agent screen so you can compare old vs new.

export default function ResearchAgentV1Page() {
  const reports = listReports();

  return (
    <div
      className="min-h-screen bg-[#212121] text-[#ECECEC]"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <header className="flex items-center justify-between bg-[#171717] px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[#ECECEC]">
            Evoke
          </Link>
          <span className="rounded-md bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#B4B4B4]">
            v1
          </span>
          <CorpusToggle />
        </div>
        <nav className="flex items-center gap-3 text-[13px] text-[#B4B4B4]">
          <Link
            href="/research-agent"
            className="inline-flex items-center rounded-full bg-[#ECECEC] px-4 py-1.5 text-[13px] font-medium text-[#0D0D0D] hover:bg-white"
          >
            Current research agent
          </Link>
          <Link href="/" className="hover:text-[#ECECEC]">
            Lab
          </Link>
        </nav>
      </header>

      <Hero />

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#ECECEC]">Example reports</h2>
            <p className="mt-1 text-sm text-[#B4B4B4]">
              Three reports baked in to demonstrate each pipeline stage.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <ExampleReportCard key={r.id} report={r} />
          ))}
        </div>

        <div className="mt-12 rounded-[12px] bg-[#2A2A2A] p-6">
          <h3 className="mb-2 text-lg font-semibold text-[#ECECEC]">How the pipeline works</h3>
          <p className="mb-4 max-w-prose text-sm text-[#B4B4B4]">
            Four stages, modeled after Elicit. Gather → Screen → Extract → Synthesize, with a
            scoped chat panel for follow-up questions on every run.
          </p>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              { n: "1", t: "Gather", d: "Rank the corpus by similarity to your question. Citation count + recency reinforce." },
              { n: "2", t: "Screen", d: "Custom screening criteria winnow the top 1,000 to the most relevant." },
              { n: "3", t: "Extract", d: "LLMs pull structured fields from each paper into a table." },
              { n: "4", t: "Generate", d: "Synthesize the extracted data into a narrative review with citations." },
            ].map((s) => (
              <li key={s.n} className="rounded-[10px] bg-[#212121] p-4">
                <div className="mb-1 text-2xl font-semibold text-[#ECECEC]">{s.n}</div>
                <div className="mb-1 text-sm font-semibold text-[#ECECEC]">{s.t}</div>
                <div className="text-xs text-[#B4B4B4]">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
