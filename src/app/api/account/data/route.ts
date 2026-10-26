import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

/** Deletes all of the signed-in user's study data. Cascades remove chunks, questions, answers and plan sessions. */
export const DELETE = handle(async () => {
  const { supabase, user } = await requireUser();
  for (const table of ["revision_plans", "quiz_sessions", "topics", "documents"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) throw new AppError("DB_FAILED", "Could not delete all data. Try again.");
  }
  return { cleared: true };
});
