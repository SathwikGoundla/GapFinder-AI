import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPlanInput, parseInput } from "@/lib/validation";
import { createPlan } from "@/lib/services/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const input = parseInput(createPlanInput, await readJson(req));
  return createPlan(supabase, user.id, { ...input, today: input.today ?? new Date().toISOString().slice(0, 10) });
});
