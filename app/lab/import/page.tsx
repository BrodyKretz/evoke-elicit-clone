import { LabShell } from "@/components/lab/LabShell";
import { ImportPapers } from "@/components/lab/ImportPapers";

export default function ImportPage() {
  return (
    <LabShell mode="extract-data">
      <ImportPapers />
    </LabShell>
  );
}
