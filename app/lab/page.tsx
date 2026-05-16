import { redirect } from "next/navigation";

// The standalone Lab landing card grid was retired — the new Evoke sidebar in
// ResearchShell covers the same navigation. Send /lab to the default agent
// surface so old links keep working.

export default function LabRoot() {
  redirect("/research-agent");
}
