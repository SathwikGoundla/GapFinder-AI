import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "../ai/provider";
import { getRagEnv } from "../env";
import { AppError } from "../errors";
import type { RetrievedChunk } from "./citations";

/**
 * Post-filter: drop below-threshold matches, near-duplicate chunks (overlap from chunking),
 * and cap results per document so one long document cannot crowd out the rest.
 */
export function filterRetrieved(rows: RetrievedChunk[], opts: { minSimilarity: number; topK: number; maxPerDocument?: number }): RetrievedChunk[] {
  const maxPerDoc = opts.maxPerDocument ?? Math.max(2, Math.ceil(opts.topK / 2));
  const perDoc = new Map<string, number>();
  const kept: RetrievedChunk[] = [];
  const sorted = [...rows].sort((a, b) => b.similarity - a.similarity);
  for (const r of sorted) {
    if (r.similarity < opts.minSimilarity) continue;
    const head = r.content.slice(0, 120);
    if (kept.some((k) => k.content.includes(head) || r.content.includes(k.content.slice(0, 120)))) continue;
    const n = perDoc.get(r.document_id) ?? 0;
    if (n >= maxPerDoc) continue;
    perDoc.set(r.document_id, n + 1);
    kept.push(r);
    if (kept.length >= opts.topK) break;
  }
  return kept;
}

export async function retrieve(
  supabase: SupabaseClient,
  query: string,
  opts: { topK?: number; minSimilarity?: number; documentIds?: string[] } = {},
): Promise<RetrievedChunk[]> {
  const rag = getRagEnv();
  const topK = opts.topK ?? rag.RAG_TOP_K;
  const minSimilarity = opts.minSimilarity ?? rag.RAG_MIN_SIMILARITY;
  const [vector] = await embed([query]);
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(vector),
    match_count: Math.min(20, topK * 3), // over-fetch, then filter
    min_similarity: minSimilarity,
    filter_document_ids: opts.documentIds ?? null,
  });
  if (error) throw new AppError("DB_FAILED", "Searching your materials failed. Try again.");
  return filterRetrieved((data ?? []) as RetrievedChunk[], { minSimilarity, topK });
}
