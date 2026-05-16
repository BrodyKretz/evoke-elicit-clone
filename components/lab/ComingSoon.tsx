import Link from "next/link";
import { ArrowRight, Search } from "@/components/ui/Icon";

type Props = {
  tool: string;
  blurb: string;
  willDo: string[];
  callout?: string;
};

export function ComingSoon({ tool, blurb, willDo, callout }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12 text-[#ECECEC]">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#2A2A2A] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#B4B4B4]">
        Coming soon
      </div>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">{tool}</h1>
      <p className="mb-7 max-w-2xl text-[15px] leading-relaxed text-[#B4B4B4]">{blurb}</p>

      <div className="mb-8 rounded-xl bg-[#2A2A2A] p-5">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#8E8E8E]">
          What this will do
        </div>
        <ul className="space-y-2 text-[14px] text-[#ECECEC]">
          {willDo.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#ECECEC]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {callout && (
        <div className="mb-8 rounded-lg bg-[#2A2A2A] px-4 py-3 text-[13px] text-[#B4B4B4]">
          {callout}
        </div>
      )}

      <div className="flex items-center gap-3 text-[13px]">
        <Link
          href="/lab/find"
          className="inline-flex items-center gap-1 rounded-full bg-[#ECECEC] px-3 py-1.5 font-medium text-[#0D0D0D] hover:bg-white"
        >
          <Search size={12} /> Try Find papers
        </Link>
        <Link href="/research-agent" className="inline-flex items-center gap-1 text-[#B4B4B4] hover:text-[#ECECEC]">
          Or run the full pipeline <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
