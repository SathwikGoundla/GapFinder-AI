import "server-only";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors";
import { getRagEnv } from "../env";
import { validateUpload, type DocumentKind } from "../ingest/validate";
import { extractPages } from "../ingest/extract";
import { chunkPages } from "../ingest/chunk";
import { embed } from "../ai/provider";

export interface IngestInput { userId: string; title: string; kind: DocumentKind; fileName: string; mimeType: string; bytes: Uint8Array; isDemo?: boolean }

export async function ingestDocument(supabase: SupabaseClient, input: IngestInput) {
  const format = validateUpload({ name: input.fileName, type: input.mimeType, size: input.bytes.byteLength, head: input.bytes.slice(0, 1024) });
  const hash = createHash("sha256").update(input.bytes).digest("hex");

  const { data: existing } = await supabase.from("documents").select("id,status,created_at").eq("content_hash", hash).maybeSingle();
  // A "processing" row older than 2 minutes means the function was killed mid-way; treat it like a failure.
  const stuck = existing?.status === "processing" && Date.now() - new Date(existing.created_at as string).getTime() > 120_000;
  if (existing && existing.status !== "failed" && !stuck) throw new AppError("DUPLICATE", "You have already uploaded this file.");
  if (existing) await supabase.from("documents").delete().eq("id", existing.id); // retry a failed or stuck upload cleanly

  const { data: doc, error } = await supabase.from("documents").insert({
    user_id: input.userId, title: input.title, kind: input.kind, file_name: input.fileName.slice(0, 200),
    mime_type: format === "pdf" ? "application/pdf" : "text/plain", size_bytes: input.bytes.byteLength,
    content_hash: hash, status: "processing", is_demo: input.isDemo ?? false,
  }).select("id").single();
  if (error || !doc) {
    if (error?.code === "23505") throw new AppError("DUPLICATE", "You have already uploaded this file.");
    throw new AppError("DB_FAILED", "Could not save the document. Try again.");
  }

  try {
    const pages = await extractPages(input.bytes, format);
    const rag = getRagEnv();
    const chunks = chunkPages(pages, { size: rag.RAG_CHUNK_SIZE, overlap: rag.RAG_CHUNK_OVERLAP });
    if (chunks.length === 0) throw new AppError("EXTRACTION_EMPTY", "The document has too little text to study from.");
    if (chunks.length > 400) throw new AppError("FILE_INVALID", "This document is too long (over 400 sections). Split it into chapters.");
    const vectors = await embed(chunks.map((c) => (c.section ? `${c.section}\n` : "") + c.content));
    const rows = chunks.map((c, i) => ({ document_id: doc.id, user_id: input.userId, ordinal: c.ordinal, page: c.page, section: c.section, content: c.content, embedding: JSON.stringify(vectors[i]) }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error: e } = await supabase.from("chunks").insert(rows.slice(i, i + 50));
      if (e) throw new AppError("DB_FAILED", "Could not save the document sections. Try again.");
    }
    const pageCount = pages.some((p) => p.page != null) ? Math.max(...pages.map((p) => p.page ?? 0)) : null;
    await supabase.from("documents").update({ status: "ready", page_count: pageCount, error: null }).eq("id", doc.id);
    return { id: doc.id, chunks: chunks.length, pages: pageCount };
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Processing failed. Try uploading again.";
    await supabase.from("chunks").delete().eq("document_id", doc.id);
    await supabase.from("documents").update({ status: "failed", error: message }).eq("id", doc.id);
    throw err;
  }
}
