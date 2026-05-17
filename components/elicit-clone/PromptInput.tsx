"use client";

import { useEffect, useState } from "react";
import { ArrowRight, PieChart, Plus } from "lucide-react";
import { WorkflowDropdown } from "./WorkflowDropdown";
import { ModeDropdown } from "./ModeDropdown";
import { MODE_OPTIONS, type WorkflowKey } from "@/lib/elicit-clone/constants";

const PLACEHOLDER =
  "Comparative efficacy of biomarkers in Lennox-Gastaut seizure prediction";

export function PromptInput() {
  const [workflow, setWorkflow] = useState<WorkflowKey>("research-agent");
  const [mode, setMode] = useState<string>("General");
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [text, setText] = useState("");

  // When the workflow changes, reset the mode to the first option in the new
  // workflow's list (or clear it if the workflow has no modes).
  useEffect(() => {
    const opts = MODE_OPTIONS[workflow];
    setMode(opts && opts.length > 0 ? opts[0] : "");
    setModeOpen(false);
  }, [workflow]);

  const modeOptions = MODE_OPTIONS[workflow];
  const showModeDropdown = modeOptions !== null && modeOptions.length > 0;

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),_0_10px_30px_rgba(31,110,104,0.06)]">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="block min-h-[120px] w-full resize-none border-0 bg-transparent text-[17px] text-text outline-none placeholder:text-text-muted focus:outline-none focus:ring-0"
        />
        {/* Decorative "G" badge per the design spec — purely visual, no integration. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-teal text-sm font-bold text-white"
        >
          G
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <WorkflowDropdown
          current={workflow}
          onPick={setWorkflow}
          open={workflowOpen}
          setOpen={(v) => {
            setWorkflowOpen(v);
            if (v) setModeOpen(false);
          }}
        />
        {showModeDropdown && (
          <ModeDropdown
            options={modeOptions ?? []}
            current={mode}
            onPick={setMode}
            open={modeOpen}
            setOpen={(v) => {
              setModeOpen(v);
              if (v) setWorkflowOpen(false);
            }}
          />
        )}

        <button
          type="button"
          aria-label="Usage"
          className="rounded-lg border border-border p-1.5 text-text hover:bg-surface-muted"
        >
          <PieChart size={16} />
        </button>
        <button
          type="button"
          aria-label="Attach"
          className="rounded-lg border border-border p-1.5 text-text hover:bg-surface-muted"
        >
          <Plus size={16} />
        </button>

        <button
          type="button"
          aria-label="Submit"
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-teal text-white transition-colors hover:bg-teal-hover"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
