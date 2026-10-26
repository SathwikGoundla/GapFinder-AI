import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { ingestDocument } from "@/lib/services/documents";
import { SAMPLE_DOCUMENTS } from "@/data/samples";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Loads the original demo course materials into the signed-in user's library. */
export const POST = handle(async () => {
  const { supabase, user } = await requireUser();
  const results: { title: string; status: "added" | "already_added" }[] = [];
  for (const doc of SAMPLE_DOCUMENTS) {
    try {
      await ingestDocument(supabase, {
        userId: user.id, title: doc.title, kind: doc.kind, fileName: doc.fileName, mimeType: "text/markdown",
        bytes: new TextEncoder().encode(doc.content), isDemo: true,
      });
      results.push({ title: doc.title, status: "added" });
    } catch (e) {
      if (e instanceof AppError && e.code === "DUPLICATE") results.push({ title: doc.title, status: "already_added" });
      else throw e;
    }
  }
  return results;
});
