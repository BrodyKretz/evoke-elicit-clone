import { Sidebar } from "@/components/elicit-clone/Sidebar";
import { PromptInput } from "@/components/elicit-clone/PromptInput";
import { RecentCard } from "@/components/elicit-clone/RecentCard";
import { JUMP_BACK_IN, SUGGESTED } from "@/lib/elicit-clone/constants";

// Static visual recreation of the Elicit.com home page used as a reference
// within Evoke's Lab. No backend wiring — dropdowns are interactive but no
// submissions actually fire.

export default function ElicitClonePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex flex-1 justify-center px-8 pt-[20vh]">
        <div className="w-full max-w-[920px]">
          <PromptInput />

          <div className="mt-10 flex items-start gap-8">
            <section className="flex-none">
              <h2 className="mb-3 text-sm text-[#6B7280]">Jump back in</h2>
              <RecentCard
                title={JUMP_BACK_IN.title}
                workflow={JUMP_BACK_IN.workflow}
                when={JUMP_BACK_IN.when}
              />
            </section>

            <section className="flex-1">
              <h2 className="mb-3 text-sm text-[#6B7280]">Suggested based on your work</h2>
              <div className="flex gap-4">
                {SUGGESTED.map((c) => (
                  <RecentCard key={c.title} title={c.title} workflow={c.workflow} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
