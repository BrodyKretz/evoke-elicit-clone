"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getNotebook,
  pinPaper,
  saveNotebook,
  subscribeNotebook,
  unpinPaper,
  type NotebookState,
} from "@/lib/notebook";
import { getLibrary, subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { useToast } from "@/components/ui/Toast";
import { Book, Check, Link as LinkIcon, Search, X } from "@/components/ui/Icon";

// Single-notebook scratchpad. Title + free-text body + pinned papers from the
// Library. Designed to bridge the gap between Find Papers (one shot) and the
// full pipeline — a place to keep loose notes alongside the papers you care
// about, without committing to a formal review.

export function NotebookView() {
  const { show } = useToast();
  const [state, setState] = useState<NotebookState>(() => getNotebook());
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => setState(getNotebook());
    refresh();
    return subscribeNotebook(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setLibrary(getLibrary());
    refresh();
    return subscribeLibrary(refresh);
  }, []);

  // Debounced autosave — fire 500ms after the last keystroke so we don't write
  // localStorage on every character but the user still gets autosave.
  const queueSave = (patch: Partial<NotebookState>) => {
    if (debounce.current) clearTimeout(debounce.current);
    setState((prev) => ({ ...prev, ...patch }));
    debounce.current = setTimeout(() => {
      saveNotebook(patch);
      setSavedAt(new Date().toISOString());
    }, 500);
  };

  const pinned = useMemo(() => {
    const ids = new Set(state.pinnedPaperIds);
    return library.filter((e) => ids.has(e.paper.id));
  }, [library, state.pinnedPaperIds]);

  const pinnableEntries = useMemo(() => {
    const ids = new Set(state.pinnedPaperIds);
    const q = pickerQuery.trim().toLowerCase();
    return library
      .filter((e) => !ids.has(e.paper.id))
      .filter((e) => {
        if (!q) return true;
        return (e.paper.title + " " + e.paper.authors.join(" ")).toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [library, state.pinnedPaperIds, pickerQuery]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10 text-text">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Notebook</h1>
        <span className="text-[12px] text-text-faint">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Autosaves locally"}
        </span>
      </div>

      <input
        value={state.title}
        onChange={(e) => queueSave({ title: e.target.value })}
        placeholder="Untitled notebook"
        className="mb-4 w-full bg-transparent text-[24px] font-semibold tracking-tight text-text outline-none placeholder:text-text-faint"
      />

      <textarea
        value={state.body}
        onChange={(e) => queueSave({ body: e.target.value })}
        placeholder="Drop notes here. Markdown is fine — this is just a scratchpad that lives in your browser."
        rows={14}
        className="mb-8 w-full resize-y rounded-xl bg-surface p-4 text-[14px] leading-relaxed text-text outline-none placeholder:text-text-faint"
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
            Pinned papers
          </div>
          <p className="mt-1 text-[12px] text-text-faint">
            Pulled from your library — the notebook just holds pointers, so
            removing here doesn&apos;t affect Library.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1 text-[12.5px] font-medium text-text hover:border-text-faint"
        >
          <Book size={12} /> {pickerOpen ? "Close" : "Pin from Library"}
        </button>
      </div>

      {pickerOpen && (
        <div className="mb-4 rounded-xl bg-surface p-3">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-[12px] text-text">
            <Search size={12} className="text-text-faint" />
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search library…"
              className="w-[260px] bg-transparent outline-none placeholder:text-text-faint"
            />
          </div>
          {library.length === 0 && (
            <div className="px-1 py-3 text-[12.5px] text-text-faint">
              Library is empty — save some papers first.
            </div>
          )}
          {library.length > 0 && pinnableEntries.length === 0 && (
            <div className="px-1 py-3 text-[12.5px] text-text-faint">
              {state.pinnedPaperIds.length === library.length
                ? "All library papers are already pinned."
                : "No library papers match that search."}
            </div>
          )}
          {pinnableEntries.length > 0 && (
            <ul className="max-h-[260px] overflow-y-auto">
              {pinnableEntries.map((e) => (
                <li
                  key={e.paper.id}
                  className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-text">{e.paper.title}</div>
                    <div className="truncate text-[11.5px] text-text-faint">
                      {e.paper.authors.slice(0, 3).join(", ")}
                      {e.paper.year ? ` · ${e.paper.year}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = pinPaper(e.paper.id);
                      if (ok) show("Pinned");
                    }}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-text px-2 py-0.5 text-[11px] font-medium text-bg hover:opacity-90"
                  >
                    <Check size={10} /> Pin
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pinned.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-center text-[13px] text-text-faint">
          No pinned papers yet. Pin from Library to keep them next to your notes.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {pinned.map((e) => (
            <li
              key={e.paper.id}
              className="rounded-xl bg-surface px-4 py-3 transition-colors hover:bg-surface-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-[14px] font-semibold leading-snug text-text">
                    {e.paper.title}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {e.paper.authors.slice(0, 4).join(", ")}
                    {e.paper.authors.length > 4 ? ` +${e.paper.authors.length - 4}` : ""}
                    {e.paper.year ? ` · ${e.paper.year}` : ""}
                    {e.paper.journal ? ` · ${e.paper.journal}` : ""}
                  </div>
                  {e.paper.doi && (
                    <a
                      href={`https://doi.org/${e.paper.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-text-muted hover:text-text"
                    >
                      <LinkIcon size={9} /> DOI
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    unpinPaper(e.paper.id);
                    show("Unpinned");
                  }}
                  className="rounded-md p-1 text-text-faint hover:bg-surface-muted hover:text-text"
                  title="Unpin from notebook"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
