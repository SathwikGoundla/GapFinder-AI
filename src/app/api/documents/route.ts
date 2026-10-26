import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { MAX_FILE_BYTES, isDocumentKind } from "@/lib/ingest/validate";
import { ingestDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_FILE_BYTES + 64 * 1024) throw new AppError("FILE_INVALID", "The file is larger than 10 MB.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  const title = String(form?.get("title") ?? "").trim();
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to upload.");
  if (!isDocumentKind(kind)) throw new AppError("VALIDATION", "Choose what kind of document this is.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ingestDocument(supabase, {
    userId: user.id, kind, fileName: file.name, mimeType: file.type, bytes,
    title: (title || file.name.replace(/\.[^.]+$/, "")).slice(0, 200),
  });
});
