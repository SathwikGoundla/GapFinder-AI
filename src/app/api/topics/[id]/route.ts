import { handle, readJson } from "@/lib/api";
import { requireUser, assertOwner } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseInput, topicPatchInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const input = parseInput(topicPatchInput, await readJson(req));
  const { data } = await supabase.from("topics").select("id,user_id").eq("id", id).maybeSingle();
  assertOwner(data, user.id, "topic");
  if (input.parentId === id) throw new AppError("VALIDATION", "A topic cannot be its own parent.");
  const patch: Record<string, unknown> = { origin: "manual" };
  if (input.name !== undefined) patch.name = input.name;
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  const { error } = await supabase.from("topics").update(patch).eq("id", id);
  if (error) throw new AppError("DB_FAILED", "Could not update the topic.");
  return { updated: id };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("topics").select("id,user_id").eq("id", id).maybeSingle();
  assertOwner(data, user.id, "topic");
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw new AppError("DB_FAILED", "Could not delete the topic.");
  return { deleted: id };
});
