# RAG Pipeline

## Steps

| # | Step | Code | Notes |
|---|---|---|---|
| 1 | Validate file | `ingest/validate.ts` | Extension + MIME + **signature** (`%PDF-`), no NUL bytes in text, ≤10 MB |
| 2 | Extract | `ingest/extract.ts` | PDFs via `unpdf`, **one entry per page**; text as UTF-8 (strict) |
| 3 | Normalize | `normalizeText()` | Joins hyphenated line breaks, collapses spaces, keeps paragraph breaks |
| 4 | Chunk | `ingest/chunk.ts` | Paragraph-aware, sentence fallback; never crosses a page; carries nearest heading as `section` |
| 5 | Embed | `ai/provider.ts → embed()` | Batches of 16; checks vector size = `AI_EMBEDDING_DIMENSIONS` |
| 6 | Store | `services/documents.ts` | `chunks(document_id, ordinal, page, section, content, embedding)`; failures roll back the chunks and mark the document `failed` |
| 7 | Retrieve | `rag/retrieve.ts` | Embed query → `match_chunks()` (cosine, HNSW index, runs as the user so RLS applies) |
| 8 | Filter | `filterRetrieved()` | Similarity threshold, remove overlap duplicates, max chunks per document, top-K |
| 9 | Generate | `services/quiz.ts`, `services/assistant.ts` | Only filtered chunks are sent, as `<evidence id=...>` blocks |
| 10 | Validate output | `ai/schemas.ts` | Zod schema per item; malformed items are dropped, not shown |
| 11 | Validate citations | `rag/citations.ts` | Cited id must be one of the retrieved chunks **and** the quote must appear in that chunk |
| 12 | Persist | questions store `evidence_chunk_id` + `evidence_quote` | Results page shows quote + document + page + section |

## Defaults (configurable in `.env.local`)

| Setting | Default | Reason |
|---|---|---|
| `RAG_CHUNK_SIZE` | 1200 chars | ~250 words: one idea per chunk, enough context for a question |
| `RAG_CHUNK_OVERLAP` | 200 chars | Keeps sentences that straddle a boundary; cut at a sentence end |
| `RAG_TOP_K` | 6 | Enough evidence without flooding the prompt |
| `RAG_MIN_SIMILARITY` | 0.55 | Drops unrelated passages; tune per embedding model |
| Embedding | `gemini-embedding-001` at 768 dims | Free tier; 768 keeps the index small |
| Per-topic evidence | up to 4 linked chunks from the topic map + 4 retrieved, merged to 5 | Linked chunks are known-relevant; search adds coverage |

## Citation validation (why similarity is not enough)

A high similarity score only means a passage is *about* the same thing. It does not prove the passage supports a specific claim. So:

1. **Id check** — the cited `chunk_id` must be in the set we retrieved for this request. Invented ids fail.
2. **Quote check** — the model must copy a quote from that chunk. We normalize case/whitespace/quotes and require the whole quote, or ≥80% of its 4-word sequences, to appear in the chunk text.
3. **Action on failure** — quiz questions are dropped (count shown in logs/response); assistant statements are removed, and if none survive the student is told the answer couldn't be verified.

This catches fabricated citations and quotes. It **cannot** prove that the model's *paraphrase* or question is a correct reading of a correctly quoted passage. Hallucinations are reduced, not eliminated.

## Known limitations

- Scanned PDFs need OCR first (no OCR built in).
- Tables, formulas and multi-column layouts may extract in a messy order.
- Heading detection is heuristic.
- No reranker model; filtering is rule-based. A cross-encoder reranker is a listed future improvement.
- Topic map uses a sample of up to 60 chunks (all syllabus chunks first) to fit the prompt; very large courses may miss minor topics.
