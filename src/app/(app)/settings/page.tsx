import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const displayName = fullName && fullName.length > 0 ? fullName : user?.email;
  const initial = (displayName ?? "A").charAt(0).toUpperCase();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section className="panel p-5">
          <h2 className="font-medium">Account</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper" aria-hidden>
              {initial}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-ink">{displayName}</p>
              {fullName && user?.email && <p className="truncate text-xs text-ink-faint">{user.email}</p>}
            </div>
          </div>
          <form action={signOut} className="mt-4"><Button variant="secondary" type="submit">Sign out</Button></form>
        </section>
        <section className="panel border-weak/30 p-5">
          <h2 className="font-medium text-weak">Delete my study data</h2>
          <p className="mt-1 text-sm text-ink-soft">Removes all materials, topics, quizzes, answers and plans. Your login stays. This cannot be undone.</p>
          <div className="mt-4"><ActionButton url="/api/account/data" method="DELETE" variant="danger" confirm="Delete ALL your materials, quizzes and plans? This cannot be undone." successMessage="All study data deleted.">Delete all study data</ActionButton></div>
        </section>
      </div>
    </>
  );
}
