"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers,
  Loader,
  Search,
  Sparkles,
} from "lucide-react";

type AgenticEvent =
  | { type: "agent.iteration"; n: number; ts: number }
  | { type: "agent.thought"; text: string; ts: number }
  | { type: "agent.tool_call"; name: string; input: Record<string, unknown>; ts: number }
  | { type: "agent.tool_result"; name: string; summary: string; ts: number }
  | { type: "agent.working_set"; total: number; added: number; ts: number }
  | {
      type: "agent.finalize";
      answer: string;
      citedIds: string[];
      citedPapers: CitedPaper[];
      ts: number;
    }
  | { type: "complete"; ts: number }
  | { type: "error"; error: string; ts: number };

type CitedPaper = {
  id: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
};

type TimelineItem =
  | { kind: "iteration"; n: number; ts: number }
  | { kind: "thought"; text: string; ts: number }
  | { kind: "tool"; name: string; input: Record<string, unknown>; result?: string; ts: number };

type Status = "connecting" | "running" | "complete" | "error";

export function TraceView({ id, question }: { id: string; question: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [answer, setAnswer] = useState<{
    text: string;
    citedIds: string[];
    citedPapers: CitedPaper[];
  } | null>(null);
  const [workingSet, setWorkingSet] = useState({ total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/agentic-rag/${id}/stream`);
    es.onopen = () => setStatus("running");
    es.onmessage = (msg) => {
      let event: AgenticEvent;
      try {
        event = JSON.parse(msg.data) as AgenticEvent;
      } catch {
        return;
      }
      handleEvent(event);
    };
    es.onerror = () => {
      es.close();
      setStatus((s) => (s === "complete" ? s : "error"));
    };

    function handleEvent(e: AgenticEvent) {
      switch (e.type) {
        case "agent.iteration":
          setItems((cur) => [...cur, { kind: "iteration", n: e.n, ts: e.ts }]);
          break;
        case "agent.thought":
          setItems((cur) => [...cur, { kind: "thought", text: e.text, ts: e.ts }]);
          break;
        case "agent.tool_call":
          setItems((cur) => [...cur, { kind: "tool", name: e.name, input: e.input, ts: e.ts }]);
          break;
        case "agent.tool_result":
          setItems((cur) => {
            for (let i = cur.length - 1; i >= 0; i--) {
              const it = cur[i];
              if (it.kind === "tool" && it.name === e.name && !it.result) {
                const next = [...cur];
                next[i] = { ...it, result: e.summary };
                return next;
              }
            }
            return cur;
          });
          break;
        case "agent.working_set":
          setWorkingSet({ total: e.total });
          break;
        case "agent.finalize":
          setAnswer({
            text: e.answer,
            citedIds: e.citedIds,
            citedPapers: e.citedPapers ?? [],
          });
          break;
        case "complete":
          setStatus("complete");
          es.close();
          break;
        case "error":
          setErrorMsg(e.error);
          setStatus("error");
          es.close();
          break;
      }
    }

    return () => es.close();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, status]);

  return (
    <div
      className="flex min-h-screen bg-bg text-text"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <Sidebar workingSetTotal={workingSet.total} status={status} />
      <main className="flex flex-1 flex-col">
        <Header question={question} status={status} />
        <div className="mx-auto w-full max-w-[920px] flex-1 px-6 pb-24 pt-6">
          {answer && (
            <FinalAnswer
              text={answer.text}
              citedIds={answer.citedIds}
              citedPapers={answer.citedPapers}
            />
          )}
          <SectionLabel
            icon={Brain}
            label={answer ? "Agent trace" : "Live agent trace"}
            sub={status === "running" ? "Streaming…" : null}
          />
          <Trace items={items} />
          {status === "error" && (
            <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4 text-[14px] text-red-500">
              {errorMsg ?? "The agent run errored. The trace above is partial."}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>
    </div>
  );
}

function Sidebar({ workingSetTotal, status }: { workingSetTotal: number; status: Status }) {
  return (
    <aside className="hidden w-[240px] flex-shrink-0 flex-col border-r border-border bg-surface-muted px-3 py-5 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-1">
        <Layers size={22} className="text-teal-bright" />
        <span className="text-xl font-semibold text-teal-bright">Evoke</span>
      </Link>
      <Link
        href="/agentic-rag"
        className="mx-1 mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-[14px] text-text-muted hover:bg-surface-muted"
      >
        <ArrowLeft size={14} />
        New agentic run
      </Link>
      <div className="mx-1 rounded-xl border border-border bg-surface p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
          Working set
        </div>
        <div className="mt-1 text-3xl font-semibold text-text">{workingSetTotal}</div>
        <div className="text-[12px] text-text-muted">papers gathered</div>
      </div>
      <div className="mt-3 mx-1 rounded-xl border border-border bg-surface p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
          Status
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-text">
          <StatusDot status={status} />
          {labelForStatus(status)}
        </div>
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cls =
    status === "running"
      ? "animate-pulse bg-teal-bright"
      : status === "complete"
      ? "bg-teal-bright"
      : status === "error"
      ? "bg-red-500"
      : "bg-text-faint";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function labelForStatus(s: Status): string {
  switch (s) {
    case "connecting":
      return "Connecting…";
    case "running":
      return "Agent running";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
  }
}

function Header({ question, status }: { question: string; status: Status }) {
  return (
    <header className="border-b border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-[920px] items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal/[0.12] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-teal-bright">
            <Sparkles size={12} />
            Agentic RAG
          </div>
          <h1 className="mt-2 text-[20px] font-semibold leading-snug text-text">{question}</h1>
        </div>
        <div className="hidden flex-shrink-0 items-center gap-2 text-[13px] text-text-muted md:flex">
          <StatusDot status={status} />
          {labelForStatus(status)}
        </div>
      </div>
    </header>
  );
}

function SectionLabel({
  icon: Icon,
  label,
  sub,
}: {
  icon: typeof Brain;
  label: string;
  sub: string | null;
}) {
  return (
    <div className="mt-2 mb-3 flex items-center gap-2">
      <Icon size={14} className="text-text-muted" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
        {label}
      </span>
      {sub && <span className="text-[11px] text-text-muted">· {sub}</span>}
    </div>
  );
}

function FinalAnswer({
  text,
  citedIds,
  citedPapers,
}: {
  text: string;
  citedIds: string[];
  citedPapers: CitedPaper[];
}) {
  // Deduplicate citation order — first appearance in citedIds wins. The papers
  // list may also contain entries the agent put in cited_ids but didn't
  // actually reference inline; render only what we have metadata for.
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of citedIds) {
    if (!seen.has(id)) {
      orderedIds.push(id);
      seen.add(id);
    }
  }
  // Index any IDs that appear in the answer text but weren't in cited_ids
  // (the model sometimes forgets to list them in cited_ids).
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (!seen.has(m[1])) {
      orderedIds.push(m[1]);
      seen.add(m[1]);
    }
  }

  const indexById = new Map<string, number>();
  orderedIds.forEach((id, i) => indexById.set(id, i + 1));
  const paperById = new Map(citedPapers.map((p) => [p.id, p]));

  return (
    <div className="mb-8 rounded-2xl border border-teal/40 bg-teal/[0.05] p-6">
      <SectionLabel icon={Check} label="Synthesis" sub={null} />
      <div className="text-[15px] leading-relaxed text-text">
        {renderAnswer(text, indexById, paperById)}
      </div>
      {orderedIds.length > 0 && (
        <div className="mt-6 border-t border-teal/20 pt-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            References
          </div>
          <ol className="space-y-1.5 text-[13px] leading-relaxed text-text-muted">
            {orderedIds.map((id, i) => {
              const p = paperById.get(id);
              return (
                <li key={id} className="flex gap-2">
                  <span className="flex-shrink-0 text-text-faint">[{i + 1}]</span>
                  <a
                    href={`https://www.semanticscholar.org/paper/${encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-text hover:text-teal-bright hover:underline"
                  >
                    {p ? formatReference(p) : `Semantic Scholar paper ${id}`}
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function formatReference(p: CitedPaper): string {
  const authors =
    p.authors.length === 0
      ? "Unknown"
      : p.authors.length > 3
      ? `${p.authors.slice(0, 3).join(", ")} et al.`
      : p.authors.join(", ");
  return `${authors} (${p.year || "n.d."}). ${p.title}.`;
}

function renderAnswer(
  text: string,
  indexById: Map<string, number>,
  paperById: Map<string, CitedPaper>
) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pi) => (
    <p key={pi} className="mb-3 last:mb-0">
      {splitWithCites(para).map((seg, si) => {
        if (!seg.cite) return <span key={si}>{seg.text}</span>;
        const num = indexById.get(seg.cite);
        const paper = paperById.get(seg.cite);
        const tooltip = paper
          ? `${formatReference(paper)}`
          : `Semantic Scholar paper ${seg.cite}`;
        return (
          <a
            key={si}
            href={`https://www.semanticscholar.org/paper/${encodeURIComponent(seg.cite)}`}
            target="_blank"
            rel="noreferrer noopener"
            title={tooltip}
            className="mx-0.5 inline-flex items-center rounded bg-teal/15 px-1.5 py-0.5 text-[11px] font-medium text-teal-bright hover:bg-teal/25 hover:underline"
          >
            [{num ?? shortId(seg.cite)}]
          </a>
        );
      })}
    </p>
  ));
}

function splitWithCites(text: string): Array<{ text: string; cite?: string }> {
  const out: Array<{ text: string; cite?: string }> = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: "", cite: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function Trace({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-[13px] text-text-muted">
        Waiting for the agent to make its first decision…
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map((it, idx) => {
        if (it.kind === "iteration") {
          return (
            <li key={idx} className="flex items-center gap-2 pt-4 first:pt-0">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                Iteration {it.n}
              </span>
              <div className="h-px flex-1 bg-border" />
            </li>
          );
        }
        if (it.kind === "thought") {
          return (
            <li
              key={idx}
              className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Brain size={16} className="mt-0.5 flex-shrink-0 text-text-muted" />
              <p className="text-[14px] leading-relaxed text-text">{it.text}</p>
            </li>
          );
        }
        return <ToolCallRow key={idx} name={it.name} input={it.input} result={it.result} />;
      })}
    </ol>
  );
}

function ToolCallRow({
  name,
  input,
  result,
}: {
  name: string;
  input: Record<string, unknown>;
  result?: string;
}) {
  const [open, setOpen] = useState(false);
  const ToolIcon = name === "search_papers" ? Search : name === "get_references" ? GitBranch : Check;
  const headline = describeToolCall(name, input);
  const pending = !result;
  return (
    <li className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ToolIcon size={16} className="flex-shrink-0 text-teal-bright" />
        <span className="flex-1 min-w-0 text-[14px] text-text">
          <span className="font-medium">{name}</span>
          <span className="text-text-muted"> · {headline}</span>
        </span>
        {pending ? (
          <Loader size={14} className="flex-shrink-0 animate-spin text-text-muted" />
        ) : (
          <span className="flex-shrink-0 text-[12px] text-text-muted">{result}</span>
        )}
        {open ? (
          <ChevronDown size={14} className="flex-shrink-0 text-text-muted" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-text-muted" />
        )}
      </button>
      {open && (
        <div className="border-t border-border bg-surface-muted px-4 py-3">
          <pre className="overflow-x-auto whitespace-pre-wrap text-[12px] leading-relaxed text-text-muted">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </li>
  );
}

function describeToolCall(name: string, input: Record<string, unknown>): string {
  if (name === "search_papers" && typeof input.query === "string") {
    return `"${input.query}"`;
  }
  if (name === "get_references" && typeof input.paper_id === "string") {
    return `refs of ${shortId(input.paper_id)}`;
  }
  return "";
}
