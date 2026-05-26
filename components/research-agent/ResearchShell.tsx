"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Atom,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  FileText,
  FlaskConical,
  Hourglass,
  Layers,
  LayoutGrid,
  Library,
  Lightbulb,
  ListChecks,
  Lock,
  Map,
  MessageCircle,
  NotebookPen,
  Plus,
  Presentation,
  RotateCcw,
  Scan,
  Search,
  Sparkles,
  Star,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { CorpusToggle, getStoredCorpus, type CorpusProvider } from "@/components/home/CorpusToggle";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/research-agent/ThemeToggle";
import { AnimatedPlaceholder } from "@/components/research-agent/AnimatedPlaceholder";
import { getLibrary, subscribeLibrary } from "@/lib/library";

// Shared shell for the four mode-aware screens — research-agent, report,
// find-papers, chat-papers. Same sidebar + top bar; the prompt card body
// switches based on the mode the page passes in.

export type Mode =
  | "research-agent"
  | "report"
  | "agentic-rag"
  | "find-papers"
  | "chat-papers"
  | "extract-data";

type ModeConfig = {
  chipLabel: string;
  chipIcon: LucideIcon;
  placeholder?: string;
  showActionChips?: boolean;
  body: "textarea" | "report-textarea" | "find-textarea" | "chat-empty";
};

const MODES: Record<Mode, ModeConfig> = {
  "research-agent": {
    chipLabel: "Research agent",
    chipIcon: Atom,
    placeholder: "Comparative efficacy of biomarkers in Lennox-Gastaut seizure prediction",
    showActionChips: true,
    body: "textarea",
  },
  report: {
    chipLabel: "Report",
    chipIcon: BookOpen,
    placeholder: "Mechanisms linking chronic sleep loss to immune dysfunction in adults",
    body: "report-textarea",
  },
  "agentic-rag": {
    chipLabel: "Agentic RAG",
    chipIcon: Sparkles,
    placeholder: "What peptides have shown efficacy in gut permeability repair?",
    body: "textarea",
  },
  "find-papers": {
    chipLabel: "Find papers",
    chipIcon: Search,
    placeholder: "Comparative efficacy of biomarkers in Lennox-Gastaut seizure prediction",
    body: "find-textarea",
  },
  "chat-papers": {
    chipLabel: "Chat with papers",
    chipIcon: MessageCircle,
    body: "chat-empty",
  },
  "extract-data": {
    chipLabel: "Extract data",
    chipIcon: Scan,
    placeholder: "Describe what you want to extract from your selected papers",
    body: "find-textarea",
  },
};

const ROUTE_BY_MODE: Record<Mode, string> = {
  "research-agent": "/research-agent",
  report: "/lab/report",
  "agentic-rag": "/agentic-rag",
  "find-papers": "/lab/find",
  "chat-papers": "/lab/chat",
  "extract-data": "/lab/extract",
};

const REPORT_EXAMPLES = [
  "GLP-1R mechanisms",
  "Magnesium effects on sleep",
  "Online vs. in-person CBT",
];

const SOURCE_OPTIONS: { label: string; count: string }[] = [
  { label: "Research papers", count: "138M papers" },
  { label: "Clinical trials", count: "500K trials" },
];

export function ResearchShell({ mode }: { mode: Mode }) {
  const [draft, setDraft] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionKey | null>(null);

  const selectedLabel = selectedAction
    ? ACTION_CHIPS.find((c) => c.action === selectedAction)?.label ?? null
    : null;

  return (
    <div
      className="flex min-h-screen bg-bg text-text"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <Sidebar mode={mode} />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="mx-auto flex w-full max-w-[920px] flex-col items-stretch px-6 pt-[14vh] pb-24">
          <PromptCard
            mode={mode}
            draft={draft}
            setDraft={setDraft}
            selectedAction={selectedAction}
            selectedLabel={selectedLabel}
            clearAction={() => setSelectedAction(null)}
          />
          {MODES[mode].showActionChips && (
            <ActionChips
              selected={selectedAction}
              onPick={(action) => setSelectedAction((cur) => (cur === action ? null : action))}
            />
          )}
          <Cards />
        </main>
      </div>
    </div>
  );
}

// ---------- Sidebar ----------

type SideItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  pro?: boolean;
  mode?: Mode;
};

const SIDE_WORKFLOWS: SideItem[] = [
  { label: "Research agent", icon: Atom, href: "/research-agent", mode: "research-agent" },
  { label: "Report", icon: BookOpen, href: "/lab/report", mode: "report" },
  { label: "Agentic RAG", icon: Sparkles, href: "/agentic-rag", mode: "agentic-rag" },
  { label: "Systematic review", icon: ListChecks, href: "/lab/review" },
];

const SIDE_TOOLS: SideItem[] = [
  { label: "Find papers", icon: Search, href: "/lab/find", mode: "find-papers" },
  { label: "Chat with papers", icon: MessageCircle, href: "/lab/chat", mode: "chat-papers" },
  { label: "Extract data", icon: Scan, href: "/lab/extract" },
  { label: "Import papers", icon: Upload, href: "/lab/import" },
  { label: "Clinical trials", icon: FlaskConical, href: "/lab/trials" },
  { label: "Notebook", icon: NotebookPen, href: "/lab/notebook" },
];

const SIDE_RECENTS = [
  "Biomarkers in Lennox-Gastaut Syndrome Seizures",
  "Sleep Deprivation and Immune Response Markers",
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-faint">
      {label}
    </div>
  );
}

function SideRow({ item, currentMode }: { item: SideItem; currentMode: Mode }) {
  const Icon = item.icon;
  const active = item.mode === currentMode;
  const inner = (
    <span
      className={
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-[15px] " +
        (active
          ? "bg-surface text-text shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-border"
          : "text-text hover:bg-surface-muted")
      }
    >
      <Icon size={18} className={active ? "text-teal-bright" : "text-text-muted"} />
      <span className={"flex-1 truncate " + (item.pro ? "text-text-muted" : "")}>{item.label}</span>
      {item.pro && <Lock size={13} className="text-text-faint" />}
    </span>
  );
  if (!item.href) return <span className="block cursor-default">{inner}</span>;
  return <Link href={item.href}>{inner}</Link>;
}

function LibraryLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(getLibrary().length);
    refresh();
    return subscribeLibrary(refresh);
  }, []);
  return (
    <Link
      href="/library"
      className="mx-1 mb-3 flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] text-text hover:bg-surface-muted"
    >
      <Library size={18} className="text-text-muted" />
      <span className="flex-1 truncate">Library</span>
      {count > 0 && (
        <span className="rounded-full bg-teal px-1.5 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ mode }: { mode: Mode }) {
  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border bg-surface-muted px-3 py-5">
      <Link href="/" className="mb-5 flex items-center gap-2 px-1">
        <Layers size={22} className="text-teal-bright" />
        <span className="text-xl font-semibold text-teal-bright">Evoke</span>
      </Link>

      <LibraryLink />

      <SectionHeader label="Workflows" />
      <div className="mb-4 flex flex-col">
        {SIDE_WORKFLOWS.map((it) => (
          <SideRow key={it.label} item={it} currentMode={mode} />
        ))}
      </div>

      <SectionHeader label="Tools" />
      <div className="mb-4 flex flex-col">
        {SIDE_TOOLS.map((it) => (
          <SideRow key={it.label} item={it} currentMode={mode} />
        ))}
      </div>

      <div className="my-2 border-t border-border" />

      <SectionHeader label="Recents" />
      <div className="flex flex-col">
        {SIDE_RECENTS.map((title) => (
          <button
            key={title}
            type="button"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-muted"
          >
            <Atom size={16} className="flex-shrink-0 text-text-muted" />
            <span className="truncate text-[14px] text-text">{title}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ---------- Top bar ----------

export function TopBar() {
  return (
    <header className="flex items-center justify-end gap-2 px-6 py-3">
      <CorpusToggle />
      <ThemeToggle />
      <Link
        href="/research-agent/v1"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-text hover:bg-surface-muted"
      >
        Research agent v1
      </Link>
    </header>
  );
}

// ---------- Workflow dropdown ----------

function WorkflowDropdown({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const CurIcon = MODES[mode].chipIcon;
  const label = MODES[mode].chipLabel;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (m: Mode) => {
    setOpen(false);
    if (m !== mode) router.push(ROUTE_BY_MODE[m]);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[13px] font-medium text-white hover:bg-white/15"
      >
        <CurIcon size={14} />
        {label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[280px] rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            Workflows
          </div>
          {(["research-agent", "report", "agentic-rag"] as Mode[]).map((m) => (
            <DropdownItem key={m} m={m} active={m === mode} onPick={pick} />
          ))}
          <DropdownItem m={null} label="Systematic review" icon={ListChecks} onPick={() => {}} />
          <div className="mt-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            Tools
          </div>
          {(["find-papers", "chat-papers"] as Mode[]).map((m) => (
            <DropdownItem key={m} m={m} active={m === mode} onPick={pick} />
          ))}
          <DropdownItem m="extract-data" active={"extract-data" === mode} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  m,
  active,
  pro,
  onPick,
  label: labelOverride,
  icon: iconOverride,
}: {
  m: Mode | null;
  active?: boolean;
  pro?: boolean;
  onPick: (m: Mode) => void;
  label?: string;
  icon?: LucideIcon;
}) {
  const Icon = iconOverride ?? (m ? MODES[m].chipIcon : Atom);
  const label = labelOverride ?? (m ? MODES[m].chipLabel : "");
  const disabled = !m;
  return (
    <button
      type="button"
      onClick={() => m && onPick(m)}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-surface-muted disabled:cursor-default"
    >
      <Icon size={18} className={active ? "text-teal-bright" : "text-text"} />
      <span className={"flex-1 truncate " + (active ? "font-semibold text-teal-bright" : "font-medium text-text")}>
        {label}
      </span>
      {pro && <Lock size={13} className="text-text-faint" />}
    </button>
  );
}

// ---------- Source dropdown (Report mode) ----------

function SourceDropdown() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(SOURCE_OPTIONS[0].label);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted"
      >
        <span className="text-text-muted">Source</span>
        <span className="font-medium">{source}</span>
        <ChevronDown size={13} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-20 w-[300px] rounded-xl border border-border bg-surface p-2 shadow-lg">
          {SOURCE_OPTIONS.map((opt) => {
            const active = opt.label === source;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setSource(opt.label);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] hover:bg-surface-muted"
              >
                <span>
                  <span className={active ? "font-semibold text-teal-bright" : "text-text"}>
                    {opt.label}
                  </span>{" "}
                  <span className="text-text-faint">({opt.count})</span>
                </span>
                {active && <Check size={14} className="text-teal-bright" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Prompt card ----------

function PromptCard({
  mode,
  draft,
  setDraft,
  selectedAction,
  selectedLabel,
  clearAction,
}: {
  mode: Mode;
  draft: string;
  setDraft: (v: string) => void;
  selectedAction: ActionKey | null;
  selectedLabel: string | null;
  clearAction: () => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const config = MODES[mode];

  const submit = async () => {
    const text = draft.trim();
    if (!text || submitting) return;

    if (mode === "find-papers") {
      router.push(`/lab/find?q=${encodeURIComponent(text)}`);
      return;
    }

    if (mode === "research-agent" || mode === "report") {
      setSubmitting(true);
      try {
        const corpus: CorpusProvider = getStoredCorpus();
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            corpus,
            action: selectedAction ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          show(body.error ?? "Failed to start run");
          return;
        }
        const { id } = (await res.json()) as { id: string };
        router.push(`/report/${id}/gather`);
      } catch {
        show("Network error. Is the dev server running?");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "agentic-rag") {
      setSubmitting(true);
      try {
        const corpus: CorpusProvider = getStoredCorpus();
        const res = await fetch("/api/agentic-rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, corpus }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          show(body.error ?? "Failed to start agentic run");
          return;
        }
        const { id } = (await res.json()) as { id: string };
        router.push(`/agentic-rag/${id}`);
      } catch {
        show("Network error. Is the dev server running?");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    show(`${config.chipLabel} submit — coming soon`);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04),_0_10px_30px_rgba(31,110,104,0.06)]">
      <div className="flex items-center bg-teal px-3 py-3">
        <WorkflowDropdown mode={mode} />
      </div>

      <div className="bg-surface">
        {config.body === "chat-empty" ? (
          <ChatEmptyBody />
        ) : (
          <PromptBody
            mode={mode}
            draft={draft}
            setDraft={setDraft}
            onSubmit={submit}
            submitting={submitting}
            selectedAction={selectedAction}
            selectedLabel={selectedLabel}
            clearAction={clearAction}
          />
        )}
      </div>
    </div>
  );
}

function PromptBody({
  mode,
  draft,
  setDraft,
  onSubmit,
  submitting,
  selectedAction,
  selectedLabel,
  clearAction,
}: {
  mode: Mode;
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  selectedAction: ActionKey | null;
  selectedLabel: string | null;
  clearAction: () => void;
}) {
  const { show } = useToast();
  const config = MODES[mode];
  const ActionIcon =
    selectedAction != null
      ? ACTION_CHIPS.find((c) => c.action === selectedAction)?.icon ?? FileText
      : null;

  return (
    <>
      <div className="relative">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="block min-h-[140px] w-full resize-none border-0 bg-surface px-5 pt-5 pb-3 text-[16px] leading-relaxed text-text outline-none focus:outline-none focus:ring-0 caret-teal"
        />
        {config.placeholder && (
          <AnimatedPlaceholder text={config.placeholder} visible={draft.length === 0} />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-5 grid h-7 w-7 place-items-center rounded-full bg-teal text-[13px] font-bold text-white"
        >
          G
        </span>
      </div>

      {mode === "report" && (
        <div className="border-t border-border px-5 py-3">
          <div className="mb-2 text-[12.5px] text-text-muted">
            Try a couple of free examples to see what this is all about
          </div>
          <div className="flex flex-wrap gap-2">
            {REPORT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setDraft(ex)}
                disabled={submitting}
                className="rounded-md bg-surface-muted px-2.5 py-1 text-[12.5px] text-text hover:bg-surface-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {mode === "research-agent" && (
            <button
              type="button"
              aria-label="Attach"
              onClick={() => show("Attach — coming soon")}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-muted"
            >
              <Plus size={16} />
            </button>
          )}
          {mode === "research-agent" && selectedAction && ActionIcon && (
            <button
              type="button"
              onClick={clearAction}
              title="Click to remove this tag"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/[0.08] px-2.5 py-1.5 text-[13px] font-medium text-teal-bright hover:border-teal/70"
            >
              <ActionIcon size={14} />
              {selectedLabel}
              <X size={12} className="opacity-60 group-hover:opacity-100" />
            </button>
          )}
          {mode === "report" && <SourceDropdown />}
        </div>
        <div className="flex items-center gap-2">
          {mode === "research-agent" && (
            <button
              type="button"
              onClick={() => show("Extended mode — coming soon")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text hover:bg-surface-muted"
            >
              <Hourglass size={14} className="text-text-muted" />
              Extended
            </button>
          )}
          <button
            type="button"
            aria-label="Submit"
            onClick={onSubmit}
            disabled={!draft.trim() || submitting}
            className="grid h-8 w-9 place-items-center rounded-lg bg-teal/25 text-teal-bright hover:bg-teal/35 disabled:opacity-50"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

function ChatEmptyBody() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-6 text-[15px] text-text-muted">
        Select sources from your library
        <br />
        or upload your own to begin a conversation
      </p>
      <Link
        href="/lab/find"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[14px] font-medium text-text hover:bg-surface-muted"
      >
        <Library size={14} className="text-text-muted" />
        Select sources
      </Link>
    </div>
  );
}

// ---------- Action chips (Research agent only) ----------

// Stable keys used to pass the chosen output shape to the synthesizer. The
// label is what the chip shows; the action is what the backend keys off of.
export type ActionKey = "table" | "slides" | "report";

const ACTION_CHIPS: { label: string; icon: typeof LayoutGrid; action: ActionKey }[] = [
  { label: "Create table", icon: LayoutGrid, action: "table" },
  { label: "Generate slides", icon: Presentation, action: "slides" },
  { label: "Draft report", icon: FileText, action: "report" },
];

function ActionChips({
  selected,
  onPick,
}: {
  selected: ActionKey | null;
  onPick: (action: ActionKey) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      {ACTION_CHIPS.map((c) => {
        const Icon = c.icon;
        const active = selected === c.action;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onPick(c.action)}
            aria-pressed={active}
            className={
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] transition-colors " +
              (active
                ? "border border-teal/40 bg-teal/[0.12] text-teal-bright"
                : "border border-border bg-surface text-text hover:bg-surface-muted")
            }
          >
            <Icon size={14} className={active ? "text-teal-bright" : "text-text-muted"} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Cards row ----------

type CardSpec = {
  pill: "Resume" | "Suggested";
  title: string;
  footer?: { workflow: string; when: string };
};

const CARDS: CardSpec[] = [
  {
    pill: "Resume",
    title: "Biomarkers in Lennox-Gastaut Syndrome Seizures",
    footer: { workflow: "Research agent", when: "Yesterday" },
  },
  {
    pill: "Suggested",
    title: "Cytokine profile changes after 24-hour sleep deprivation",
  },
  {
    pill: "Suggested",
    title: "Comparative efficacy of biomarkers in Lennox-Gastaut seizure prediction",
  },
];

function Cards() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
      {CARDS.map((c) => {
        const Pill = c.pill === "Resume" ? RotateCcw : Lightbulb;
        return (
          <Link
            key={c.title}
            href="/research-agent"
            className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-border-strong hover:shadow-sm"
          >
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
              <Pill size={12} />
              {c.pill}
            </span>
            <span className="text-sm font-medium leading-snug text-text">{c.title}</span>
            {c.footer && (
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                {c.footer.workflow} · {c.footer.when}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
