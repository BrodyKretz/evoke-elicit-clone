// Single source of truth for screening-decision visuals. Tuned for the
// light (warm-paper) theme so Review badges match the rest of Evoke.
export type Decision = "include" | "maybe" | "exclude";

export const decisionStyles: Record<
  Decision,
  { label: string; badge: string; row: string }
> = {
  include: {
    label: "Include",
    badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    row: "border-emerald-200 bg-emerald-50/60",
  },
  maybe: {
    label: "Maybe",
    badge: "bg-amber-100 text-amber-800 border border-amber-200",
    row: "border-amber-200 bg-amber-50/60",
  },
  exclude: {
    label: "Exclude",
    badge: "bg-rose-100 text-rose-800 border border-rose-200",
    row: "border-rose-200 bg-rose-50/50",
  },
};
