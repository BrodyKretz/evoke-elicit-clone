// Client-side localStorage-backed key store.
// Keys never touch our backend except per-request via headers.

const STORAGE_KEY = "evoke.api-keys.v1";

export type ClientKeys = {
  anthropicKey?: string;
  s2Key?: string;
};

export function getStoredKeys(): ClientKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ClientKeys;
    return {
      anthropicKey: typeof parsed.anthropicKey === "string" ? parsed.anthropicKey : undefined,
      s2Key: typeof parsed.s2Key === "string" ? parsed.s2Key : undefined,
    };
  } catch {
    return {};
  }
}

export function setStoredKeys(keys: ClientKeys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new CustomEvent("evoke:keys-changed"));
}

export function clearStoredKeys() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("evoke:keys-changed"));
}

export function hasAnthropicKey(): boolean {
  return Boolean(getStoredKeys().anthropicKey?.trim());
}

// Header object spread into fetch() init.headers — strips empty values.
export function keyHeaders(): Record<string, string> {
  const { anthropicKey, s2Key } = getStoredKeys();
  const h: Record<string, string> = {};
  if (anthropicKey?.trim()) h["x-anthropic-api-key"] = anthropicKey.trim();
  if (s2Key?.trim()) h["x-s2-api-key"] = s2Key.trim();
  return h;
}
