"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Paper } from "@/lib/types";
import { Book, Search, User } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSelectedPapers, subscribeSelection } from "@/lib/lab/selection";

type Message = {
  role: "user" | "assistant";
  content: string;
  isDumDum?: boolean;
  hasDumDum?: boolean;
};

export function LabChat() {
  const { show } = useToast();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [paperListOpen, setPaperListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setPapers(getSelectedPapers());
    refresh();
    return subscribeSelection(refresh);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const streamSse = async (
    response: Response,
    onDelta: (s: string) => void
  ): Promise<boolean> => {
    if (!response.body) return false;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const data = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "done" }
            | { type: "error"; error: string };
          if (data.type === "delta") onDelta(data.text);
          else if (data.type === "error") {
            show(`Chat error: ${data.error}`);
            return false;
          }
        } catch {
          // ignore malformed events
        }
      }
    }
    return true;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming || papers.length === 0) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setDraft("");
    setStreaming(true);

    try {
      const res = await fetch("/api/lab/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers, messages, userMessage: text, topic: topic.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        show(body.error ?? "Chat failed");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      let acc = "";
      await streamSse(res, (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      });
    } catch {
      show("Network error during chat");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const simplify = async (sourceIdx: number) => {
    if (streaming) return;
    const source = messages[sourceIdx];
    if (!source || source.role !== "assistant" || source.isDumDum) return;

    setStreaming(true);
    setMessages((prev) => {
      const next = [...prev];
      next[sourceIdx] = { ...next[sourceIdx], hasDumDum: true };
      next.splice(sourceIdx + 1, 0, { role: "assistant", content: "", isDumDum: true });
      return next;
    });

    try {
      const res = await fetch("/api/lab/chat/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source.content }),
      });
      if (!res.ok) {
        show("DumDum failed");
        setMessages((prev) => {
          const next = [...prev];
          const dumIdx = next.findIndex(
            (m, i) => i > sourceIdx && m.isDumDum && m.content === ""
          );
          if (dumIdx !== -1) next.splice(dumIdx, 1);
          if (next[sourceIdx]) next[sourceIdx] = { ...next[sourceIdx], hasDumDum: false };
          return next;
        });
        return;
      }
      let acc = "";
      await streamSse(res, (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const next = [...prev];
          const dumIdx = next.findIndex(
            (m, i) => i > sourceIdx && m.isDumDum && (m.content === "" || acc.startsWith(m.content))
          );
          if (dumIdx !== -1) next[dumIdx] = { ...next[dumIdx], content: acc };
          return next;
        });
      });
    } catch {
      show("Network error during DumDum");
    } finally {
      setStreaming(false);
    }
  };

  if (papers.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-transparent bg-surface px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-text-muted">
          Lab · Tool
        </div>
        <h1 className="mb-3 font-display text-3xl font-medium tracking-tight text-text">
          Chat with papers
        </h1>
        <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-text-muted">
          You haven&apos;t selected any papers yet. Head to{" "}
          <Link href="/lab/find" className="font-medium text-text hover:underline">
            Find papers
          </Link>{" "}
          and check the boxes next to papers you want to discuss. Your selection is saved
          across the Lab.
        </p>
        <Link
          href="/lab/find"
          className="inline-flex items-center gap-1 rounded-full bg-text px-4 py-1.5 text-[13px] font-medium text-bg hover:bg-white"
        >
          <Search size={12} /> Find papers
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-60px)] max-w-4xl flex-col px-8 py-6">
      <div className="mb-1 inline-flex items-center gap-1.5 self-start rounded-full border border-transparent bg-surface px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-text-muted">
        Lab · Tool
      </div>
      <h1 className="mb-2 font-display text-2xl font-medium tracking-tight text-text">
        Chat with {papers.length} paper{papers.length === 1 ? "" : "s"}
      </h1>

      <div className="mb-4 rounded-[10px] border border-transparent bg-surface">
        <button
          onClick={() => setPaperListOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-[12.5px] font-medium text-text-muted hover:text-text"
        >
          <span>{paperListOpen ? "Hide" : "Show"} selected papers</span>
          <span className="text-text-faint">{papers.length}</span>
        </button>
        {paperListOpen && (
          <ul className="border-t border-transparent px-3 py-2 text-[12.5px]">
            {papers.map((p) => (
              <li key={p.id} className="flex items-start gap-2 py-1">
                <User size={11} className="mt-1 flex-shrink-0 text-text-faint" />
                <div className="min-w-0">
                  <div className="truncate font-medium text-text">{p.title}</div>
                  <div className="text-text-muted">
                    <Book size={9} className="mr-1 inline" />
                    {p.authors.slice(0, 2).join(", ")}
                    {p.authors.length > 2 ? " et al." : ""} · {p.year || "n.d."}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Optional: what's the overall topic? (helps frame the chat)"
        className="mb-3 w-full rounded-md border border-transparent bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-border-strong"
      />

      <div
        ref={scrollRef}
        className="mb-3 flex-1 overflow-y-auto rounded-[10px] border border-transparent bg-surface p-3"
      >
        {messages.length === 0 ? (
          <div className="space-y-2 text-[13px] text-text-muted">
            <p>Ask anything about your selected papers:</p>
            <ul className="space-y-1 text-xs">
              <li>· Compare findings across two papers</li>
              <li>· Explain a methodology</li>
              <li>· What do they agree / disagree on?</li>
            </ul>
            <p className="pt-2 text-xs italic">
              For topics not covered by the papers, the model will prefix general background as{" "}
              <span className="font-semibold">General background (not from your papers):</span>
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => {
              const isAssistant = m.role === "assistant";
              const canSimplify =
                isAssistant && !m.isDumDum && !m.hasDumDum && m.content.length > 200 && !streaming;
              return (
                <li
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[13px] text-text"
                      : m.isDumDum
                      ? "mr-2 rounded-md border-l-2 border-teal bg-surface-muted/30 px-2 py-1.5 text-[13px] leading-relaxed text-text"
                      : "mr-2 text-[13px] leading-relaxed text-text"
                  }
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {m.role === "user" ? "You" : m.isDumDum ? "Evoke · DumDum" : "Evoke"}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </div>
                  {canSimplify && (
                    <button
                      type="button"
                      onClick={() => simplify(i)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-muted hover:border-border-strong hover:text-text"
                      title="Rewrite this answer in plain language for a high-schooler."
                    >
                      DumDum it
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          disabled={streaming}
          placeholder="Ask a question about these papers…"
          className="flex-1 resize-none rounded-md border border-transparent bg-surface px-3 py-2 text-[13px] outline-none focus:border-border-strong disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || streaming}
          className="rounded-full bg-text px-4 py-1.5 text-[13px] font-medium text-bg hover:bg-white disabled:opacity-50"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
