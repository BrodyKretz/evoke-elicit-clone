"use client";

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { MessageSquare } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

type Message = {
  role: "user" | "assistant";
  content: string;
  // True when this message is the simpler "DumDum" rewrite of another
  // assistant message. Lets us label it differently in the UI and skip
  // showing a DumDum-of-DumDum button.
  isDumDum?: boolean;
  // For original assistant messages: true once a DumDum version has been
  // generated below. Used to disable the button so the user can't double-add.
  hasDumDum?: boolean;
};

// Sidebar chat panel. Scoped to one report. Streams Opus 4.7 responses via SSE.
// Requires the run to have completed synthesis — disabled otherwise.
export function ChatPanel({ report }: { report: Report }) {
  const { show } = useToast();
  const ready = report.status.generate.done;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the message list as new content arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming || !ready) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setDraft("");
    setStreaming(true);

    try {
      const res = await fetch(`/api/reports/${report.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, userMessage: text }),
      });
      if (!res.ok || !res.body) {
        show("Chat failed");
        setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant placeholder
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
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
            if (data.type === "delta") {
              acc += data.text;
              // Update the last assistant message progressively.
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: acc };
                return next;
              });
            } else if (data.type === "error") {
              show(`Chat error: ${data.error}`);
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch {
      show("Network error during chat");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  // DumDum: send the original assistant message to the simplify endpoint and
  // stream the result into a new assistant bubble flagged as the dumdum
  // version. Disables the original's DumDum button while streaming.
  const simplify = async (sourceIdx: number) => {
    if (streaming) return;
    const source = messages[sourceIdx];
    if (!source || source.role !== "assistant" || source.isDumDum) return;

    setStreaming(true);
    // Mark the source as having a DumDum in flight, and append an empty
    // placeholder right after it.
    setMessages((prev) => {
      const next = [...prev];
      next[sourceIdx] = { ...next[sourceIdx], hasDumDum: true };
      next.splice(sourceIdx + 1, 0, { role: "assistant", content: "", isDumDum: true });
      return next;
    });

    try {
      const res = await fetch(`/api/reports/${report.id}/chat/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source.content }),
      });
      if (!res.ok || !res.body) {
        show("DumDum failed");
        // Roll back the placeholder.
        setMessages((prev) => {
          const next = [...prev];
          // Find the empty placeholder by content+flag and drop it.
          const dumIdx = next.findIndex(
            (m, i) => i > sourceIdx && m.isDumDum && m.content === ""
          );
          if (dumIdx !== -1) next.splice(dumIdx, 1);
          if (next[sourceIdx]) next[sourceIdx] = { ...next[sourceIdx], hasDumDum: false };
          return next;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
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
            if (data.type === "delta") {
              acc += data.text;
              setMessages((prev) => {
                const next = [...prev];
                // Update the DumDum placeholder that lives immediately after
                // the source message. Indices may have shifted if other
                // messages have been added, so search by adjacency.
                const dumIdx = next.findIndex(
                  (m, i) =>
                    i > sourceIdx &&
                    m.isDumDum &&
                    (m.content === "" || m.content === acc.slice(0, m.content.length))
                );
                if (dumIdx !== -1) {
                  next[dumIdx] = { ...next[dumIdx], content: acc };
                }
                return next;
              });
            } else if (data.type === "error") {
              show(`DumDum error: ${data.error}`);
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch {
      show("Network error during DumDum");
    } finally {
      setStreaming(false);
    }
  };

  if (!ready) {
    return (
      <div className="rounded-[10px] border border-border bg-surface px-4 py-5 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center text-text-muted">
          <MessageSquare size={36} />
        </div>
        <h3 className="mb-1.5 mt-3.5 text-sm font-semibold">Got some follow-up questions?</h3>
        <p className="text-[13px] text-text-muted">
          Chat unlocks once the report is fully generated.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[460px] flex-col rounded-[10px] border border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5 text-[13px] font-semibold">
        Chat with this report
      </div>

      <div ref={scrollRef} className="scroll-pane flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2 text-[13px] text-text-muted">
            <p>Ask anything about the studies in this report:</p>
            <ul className="space-y-1 text-xs">
              <li>· Compare findings across two papers</li>
              <li>· Explain a methodology</li>
              <li>· Summarize limitations</li>
              <li>· Synthesize across the included studies</li>
            </ul>
            <p className="pt-2 text-xs italic">
              I can only discuss the studies in this run — not external knowledge.
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
                      ? "ml-6 rounded-lg bg-teal-light px-2.5 py-1.5 text-[13px] text-text"
                      : m.isDumDum
                      ? "mr-2 rounded-md border-l-2 border-teal bg-teal-light/30 px-2 py-1.5 text-[13px] leading-relaxed text-text"
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
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-muted hover:border-teal hover:text-teal"
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
        className="border-t border-border p-2"
      >
        <div className="flex items-end gap-2">
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
            placeholder="Ask a follow-up question…"
            className="flex-1 resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-teal disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            className="btn btn-primary disabled:opacity-60"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
