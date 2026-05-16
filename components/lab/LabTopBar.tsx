import Link from "next/link";

// Lab top bar styled like the ChatGPT chrome — empty on the left (sidebar
// carries the brand), with a single white-pill action on the right that
// surfaces the inverted-role "Research agent v1" entry. Mirrors the
// position the old "Lab" pill held on the previous home page.
export function LabTopBar() {
  return (
    <header className="flex h-12 items-center justify-end bg-bg px-5">
      <Link
        href="/research-agent"
        className="inline-flex items-center rounded-full bg-text px-4 py-1.5 text-[13px] font-medium text-surface hover:bg-text"
      >
        Research agent
      </Link>
      <Link
        href="/research-agent/v1"
        className="ml-2 inline-flex items-center rounded-full border border-border-strong bg-transparent px-3 py-1 text-[12px] font-medium text-text-muted hover:border-border hover:text-text"
      >
        v1
      </Link>
    </header>
  );
}
