export const dynamic = "force-dynamic";

import { Logo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/setup-notice";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        {isSupabaseConfigured() ? <div className="panel p-6 shadow-lift">{children}</div> : <SetupNotice />}
      </div>
    </main>
  );
}
