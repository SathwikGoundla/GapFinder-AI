/**
 * Citation validation. A cited chunk must (1) be one of the chunks we actually retrieved and
 * (2) contain the quoted text (after whitespace/punctuation normalization).
 * Similarity alone is NOT treated as proof of support.
 */
export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  page: number | null;
  section: string | null;
  similarity: number;
}

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9%.'" ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Fraction of the quote's word 4-grams found in the source (tolerates minor extraction differences). */
export function quoteSupport(quote: string, source: string): number {
  const q = normalizeForMatch(quote);
  const s = normalizeForMatch(source);
  if (!q) return 0;
  if (s.includes(q)) return 1;
  const words = q.split(" ");
  if (words.length < 4) return 0;
  let hits = 0;
  const total = words.length - 3;
  for (let i = 0; i < total; i++) if (s.includes(words.slice(i, i + 4).join(" "))) hits++;
  return hits / total;
}

export type CitationResult =
  | { ok: true; chunk: RetrievedChunk; support: number }
  | { ok: false; reason: "unknown_chunk" | "quote_not_found" };

export const MIN_QUOTE_SUPPORT = 0.8;

export function validateCitation(chunkId: string, quote: string, retrieved: RetrievedChunk[]): CitationResult {
  const chunk = retrieved.find((c) => c.id === chunkId);
  if (!chunk) return { ok: false, reason: "unknown_chunk" };
  const support = quoteSupport(quote, chunk.content);
  if (support < MIN_QUOTE_SUPPORT) return { ok: false, reason: "quote_not_found" };
  return { ok: true, chunk, support };
}
