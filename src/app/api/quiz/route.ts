import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createQuizInput, parseInput } from "@/lib/validation";
import { createQuiz } from "@/lib/services/quiz";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const input = parseInput(createQuizInput, await readJson(req));
  return createQuiz(supabase, user.id, input);
});
