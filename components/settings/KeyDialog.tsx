"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { getStoredKeys, setStoredKeys, clearStoredKeys } from "@/lib/client-keys";

type Ctx = {
  open: () => void;
  isOpen: boolean;
};

const KeyDialogContext = createContext<Ctx>({ open: () => {}, isOpen: false });

export function useKeyDialog() {
  return useContext(KeyDialogContext);
}

export function KeyDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <KeyDialogContext.Provider value={{ open, isOpen }}>
      {children}
      <KeyDialog open={isOpen} onClose={close} />
    </KeyDialogContext.Provider>
  );
}

function KeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [anthropic, setAnthropic] = useState("");
  const [s2, setS2] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const cur = getStoredKeys();
    setAnthropic(cur.anthropicKey ?? "");
    setS2(cur.s2Key ?? "");
    setSavedAt(null);
  }, [open]);

  const save = () => {
    setStoredKeys({
      anthropicKey: anthropic.trim() || undefined,
      s2Key: s2.trim() || undefined,
    });
    setSavedAt(Date.now());
    // Auto-close after a moment so the user sees the confirmation.
    setTimeout(onClose, 600);
  };

  const clearAll = () => {
    clearStoredKeys();
    setAnthropic("");
    setS2("");
    setSavedAt(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="API keys" widthClass="max-w-lg">
      <div className="space-y-5">
        <p className="text-[13px] leading-relaxed text-text-muted">
          Evoke uses your own API keys so the live demo doesn&rsquo;t burn the
          author&rsquo;s credits. Keys are stored in your browser&rsquo;s
          localStorage and sent per-request as HTTPS headers. They are never
          persisted server-side.
        </p>

        <div>
          <label className="block text-[13px] font-medium text-text">
            Anthropic API key <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-[12px] text-text-muted">
            Required. Get one at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer noopener"
              className="text-teal-bright hover:underline"
            >
              console.anthropic.com
            </a>
            . Used for the Claude calls (Haiku / Sonnet / Opus).
          </p>
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={anthropic}
            onChange={(e) => setAnthropic(e.target.value)}
            className="mt-2 block w-full rounded-md border border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-teal focus:ring-1 focus:ring-teal"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-text">
            Semantic Scholar API key{" "}
            <span className="text-text-faint">(optional)</span>
          </label>
          <p className="mt-1 text-[12px] text-text-muted">
            Optional. The unauthenticated S2 tier works but is heavily rate
            limited; a key raises your quota. Apply at{" "}
            <a
              href="https://www.semanticscholar.org/product/api#api-key-form"
              target="_blank"
              rel="noreferrer noopener"
              className="text-teal-bright hover:underline"
            >
              semanticscholar.org
            </a>
            .
          </p>
          <input
            type="password"
            autoComplete="off"
            placeholder="leave blank to use the free unauthenticated tier"
            value={s2}
            onChange={(e) => setS2(e.target.value)}
            className="mt-2 block w-full rounded-md border border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-teal focus:ring-1 focus:ring-teal"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] text-text-muted hover:text-text"
          >
            Clear stored keys
          </button>
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="text-[12px] text-teal-bright">Saved</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[13px] text-text-muted hover:bg-surface-muted hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!anthropic.trim()}
              className="rounded-md bg-teal px-3 py-1.5 text-[13px] font-medium text-white hover:bg-teal-bright disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
