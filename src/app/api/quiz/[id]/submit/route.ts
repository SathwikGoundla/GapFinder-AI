import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseInput, submitQuizInput } from "@/lib/validation";
import { submitQuiz } from "@/lib/services/quiz";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { answers } = parseInput(submitQuizInput, await readJson(req));
  return submitQuiz(supabase, user.id, id, answers);
});
