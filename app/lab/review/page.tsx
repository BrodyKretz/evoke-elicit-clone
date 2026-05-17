import { LabShell } from "@/components/lab/LabShell";
import { ReviewSearch } from "@/components/lab/ReviewSearch";

export default function ReviewPage() {
  return (
    <LabShell mode="extract-data">
      <ReviewSearch />
    </LabShell>
  );
}
