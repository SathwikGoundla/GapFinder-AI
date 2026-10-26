import { handle } from "@/lib/api";
import { requireUser, assertOwner } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("documents").select("id,user_id").eq("id", id).maybeSingle();
  assertOwner(data, user.id, "document");
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new AppError("DB_FAILED", "Could not delete the document.");
  return { deleted: id };
});
