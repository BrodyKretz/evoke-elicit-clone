import { Lock } from "lucide-react";

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5">
      <Lock size={11} className="text-text-muted" />
      <span className="text-[10px] font-medium tracking-wide text-text-muted">PRO</span>
    </span>
  );
}
