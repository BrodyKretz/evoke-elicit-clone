import { Atom } from "lucide-react";

type Props = {
  title: string;
  workflow: string;
  when?: string;
};

export function RecentCard({ title, workflow, when }: Props) {
  return (
    <button
      type="button"
      className="flex w-[300px] flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
    >
      <span className="inline-flex items-center gap-1 self-start rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
        <Atom size={12} />
        {workflow}
      </span>
      <span className="text-sm font-medium leading-snug text-text">{title}</span>
      {when && (
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" />
          {when}
        </span>
      )}
    </button>
  );
}
