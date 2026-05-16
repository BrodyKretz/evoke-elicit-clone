// Single-notebook scratchpad. Markdown body + a list of pinned paper ids that
// reference entries in the user's Library. Backed by localStorage; broadcast
// changes through a CustomEvent so any open tab/component stays in sync.

const KEY = "evoke.notebook";
const EVENT = "evoke:notebook-change";

export type NotebookState = {
  title: string;
  body: string;
  pinnedPaperIds: string[];
  updatedAt: string;
};

const EMPTY: NotebookState = {
  title: "Untitled notebook",
  body: "",
  pinnedPaperIds: [],
  updatedAt: new Date(0).toISOString(),
};

function read(): NotebookState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<NotebookState>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : EMPTY.title,
      body: typeof parsed.body === "string" ? parsed.body : "",
      pinnedPaperIds: Array.isArray(parsed.pinnedPaperIds)
        ? parsed.pinnedPaperIds.filter((x): x is string => typeof x === "string")
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : EMPTY.updatedAt,
    };
  } catch {
    return EMPTY;
  }
}

function write(next: NotebookState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getNotebook(): NotebookState {
  return read();
}

export function saveNotebook(patch: Partial<Omit<NotebookState, "updatedAt">>): void {
  const cur = read();
  write({
    title: patch.title ?? cur.title,
    body: patch.body ?? cur.body,
    pinnedPaperIds: patch.pinnedPaperIds ?? cur.pinnedPaperIds,
    updatedAt: new Date().toISOString(),
  });
}

export function pinPaper(id: string): boolean {
  const cur = read();
  if (cur.pinnedPaperIds.includes(id)) return false;
  write({ ...cur, pinnedPaperIds: [...cur.pinnedPaperIds, id], updatedAt: new Date().toISOString() });
  return true;
}

export function unpinPaper(id: string): void {
  const cur = read();
  write({
    ...cur,
    pinnedPaperIds: cur.pinnedPaperIds.filter((x) => x !== id),
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeNotebook(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
