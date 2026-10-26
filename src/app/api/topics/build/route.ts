import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { buildTopicMap } from "@/lib/services/topics";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const body = (await readJson(req)) as { replace?: unknown } | null;
  return buildTopicMap(supabase, user.id, { replace: body?.replace === true });
});
