import { LabShell } from "@/components/lab/LabShell";
import { NotebookView } from "@/components/lab/NotebookView";

export default function NotebookPage() {
  return (
    <LabShell mode="extract-data">
      <NotebookView />
    </LabShell>
  );
}
