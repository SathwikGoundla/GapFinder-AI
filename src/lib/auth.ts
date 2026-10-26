import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { AppError } from "./errors";

/** Every API handler starts here. RLS is the second line of defence, not the first. */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AppError("UNAUTHORIZED", "Your session has expired. Sign in again.", { retryable: false });
  return { supabase, user: data.user };
}

/** Explicit ownership check used before writes, in addition to RLS. */
export function assertOwner(row: { user_id: string } | null | undefined, userId: string, what = "item"): asserts row is { user_id: string } {
  if (!row) throw new AppError("NOT_FOUND", `That ${what} was not found.`);
  if (row.user_id !== userId) throw new AppError("FORBIDDEN", `You do not have access to that ${what}.`);
}
