import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <LibraryView />
    </div>
  );
}
