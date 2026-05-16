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
      className="flex w-[300px] flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
    >
      <span className="inline-flex items-center gap-1 self-start rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6B7280]">
        <Atom size={12} />
        {workflow}
      </span>
      <span className="text-sm font-medium leading-snug text-[#1F2937]">{title}</span>
      {when && (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1F6E68]" />
          {when}
        </span>
      )}
    </button>
  );
}
