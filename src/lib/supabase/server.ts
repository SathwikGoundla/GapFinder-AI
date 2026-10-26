import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "../env";

/** Server client bound to the user's session cookie. Uses the anon key, so RLS always applies. */
export async function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a Server Component: middleware refreshes cookies instead */ }
      },
    },
  });
}
