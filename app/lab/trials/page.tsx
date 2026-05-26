import { Suspense } from "react";
import { LabShell } from "@/components/lab/LabShell";
import { TrialsSearch } from "@/components/lab/TrialsSearch";

export default function ClinicalTrialsPage() {
  return (
    <LabShell mode="extract-data">
      <Suspense fallback={null}>
        <TrialsSearch />
      </Suspense>
    </LabShell>
  );
}
