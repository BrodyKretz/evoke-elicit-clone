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
    <div className="mx-auto max-w-3xl px-8 py-12 text-text">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        Coming soon
      </div>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">{tool}</h1>
      <p className="mb-7 max-w-2xl text-[15px] leading-relaxed text-text-muted">{blurb}</p>

      <div className="mb-8 rounded-xl bg-surface p-5">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-faint">
          What this will do
        </div>
        <ul className="space-y-2 text-[14px] text-text">
          {willDo.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-text" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {callout && (
        <div className="mb-8 rounded-lg bg-surface px-4 py-3 text-[13px] text-text-muted">
          {callout}
        </div>
      )}

      <div className="flex items-center gap-3 text-[13px]">
        <Link
          href="/lab/find"
          className="inline-flex items-center gap-1 rounded-full bg-text px-3 py-1.5 font-medium text-bg hover:bg-white"
        >
          <Search size={12} /> Try Find papers
        </Link>
        <Link href="/research-agent" className="inline-flex items-center gap-1 text-text-muted hover:text-text">
          Or run the full pipeline <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
