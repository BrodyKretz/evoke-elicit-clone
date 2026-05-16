import { redirect } from "next/navigation";

// Default landing → Research agent. The previous detour through /lab is gone
// now that the light Evoke shell IS the navigation.
export default function RootPage() {
  redirect("/research-agent");
}
