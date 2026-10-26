import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assistantInput, parseInput } from "@/lib/validation";
import { askAssistant } from "@/lib/services/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { supabase } = await requireUser();
  const { question, topicId } = parseInput(assistantInput, await readJson(req));
  let topicName: string | null = null;
  if (topicId) {
    const { data } = await supabase.from("topics").select("name").eq("id", topicId).maybeSingle();
    topicName = (data?.name as string | undefined) ?? null;
  }
  return askAssistant(supabase, question, topicName);
});
