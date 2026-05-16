// Passthrough. The dark Lab chrome was retired in favor of the light Evoke
// sidebar inside ResearchShell, which the /lab/* pages render themselves.
// Leaving the file present so Next.js still treats `app/lab` as a segment.

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
