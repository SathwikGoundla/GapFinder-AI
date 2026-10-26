import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <main id="main" className="mx-auto max-w-lg p-8"><SetupNotice /></main>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const displayName = fullName && fullName.length > 0 ? fullName : (user.email ?? "Account");
  return (
    <div className="lg:flex">
      <AppNav displayName={displayName} email={user.email ?? "Account"} />
      <main id="main" className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
