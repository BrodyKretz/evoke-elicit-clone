import { Lock } from "lucide-react";

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-1.5 py-0.5">
      <Lock size={11} className="text-[#6B7280]" />
      <span className="text-[10px] font-medium tracking-wide text-[#6B7280]">PRO</span>
    </span>
  );
}
