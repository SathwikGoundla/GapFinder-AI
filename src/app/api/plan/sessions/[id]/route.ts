import { handle, readJson } from "@/lib/api";
import { requireUser, assertOwner } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseInput, sessionPatchInput } from "@/lib/validation";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { completed } = parseInput(sessionPatchInput, await readJson(req));
  const { data } = await supabase.from("revision_sessions").select("id,user_id").eq("id", id).maybeSingle();
  assertOwner(data, user.id, "session");
  const { error } = await supabase.from("revision_sessions").update({ completed_at: completed ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new AppError("DB_FAILED", "Could not update the session.");
  return { id, completed };
});
