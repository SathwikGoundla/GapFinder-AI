# Database Schema

Migration: `supabase/migrations/0001_init.sql`. Every table has `user_id` (defaults to `auth.uid()`), RLS enabled, and four owner policies (select/insert/update/delete where `user_id = auth.uid()`).

| Table | Purpose | Key columns / constraints |
|---|---|---|
| `documents` | Uploaded materials | `kind` (syllabus/notes/textbook/past_paper), `status` (processing/ready/failed), `error`, `content_hash` — **unique per user** (duplicate detection), size ≤ 10 MB, `is_demo` |
| `chunks` | Searchable sections | `document_id` (cascade), `ordinal`, `page`, `section`, `content`, `embedding vector(768)`; HNSW cosine index |
| `topics` | Topic map | `parent_id` (self, cascade), `origin` (syllabus/inferred/manual), `prerequisite_ids uuid[]` |
| `topic_sources` | Topic ↔ chunk links | PK (`topic_id`, `chunk_id`) |
| `quiz_sessions` | A quiz attempt | `status` (in_progress/submitted), `topic_ids`, `idempotency_key` — **unique per user** (no duplicate quizzes from double clicks) |
| `questions` | Generated questions | `type`, `difficulty`, `options`, `correct_option`, `expected_answer`, `evidence_chunk_id`, `evidence_quote`; check: MCQ must have options + correct option |
| `answers` | Student answers + grading | `question_id` **unique** (one answer per question), `verdict`, `score` 0–1, `method` (objective/ai_semantic/none), `feedback`, `missing_points` |
| `topic_assessments` | Rating snapshot per topic per attempt (progress history) | unique (`topic_id`, `session_id`) |
| `revision_plans` | Plan settings | `exam_date`, `daily_minutes` 15–600, `status` active/archived, `based_on_session_id` |
| `revision_sessions` | Scheduled sessions | `scheduled_date`, `minutes`, `objectives` jsonb, `chunk_ids`, `priority_reason`, `completed_at` |

Function `match_chunks(query_embedding, match_count, min_similarity, filter_document_ids)` is `security invoker` and also filters `user_id = auth.uid()`, so vector search can never return another user's chunks.

Deleting a document cascades to its chunks and to questions that cite them. Deleting a user (auth) cascades to everything.
