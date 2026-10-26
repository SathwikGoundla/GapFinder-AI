# Limitations and Future Work

## Limitations to disclose

1. **Real AI provider not verified.** The full workflow, auth and RLS were verified on a local Supabase-equivalent stack (Postgres + pgvector + Supabase Auth + PostgREST), but with a test-only AI stub. Real question quality, grading accuracy, latency and the `RAG_MIN_SIMILARITY=0.55` default are untested. See BUILD_AND_VERIFICATION_REPORT.md.
2. **AI can still be wrong.** Citations and quotes are verified, but a question or grading decision can misread a correctly quoted passage. Every result shows its source so students can check.
3. **Small quizzes give rough ratings.** That's why "Not enough evidence" and confidence levels exist. Ratings measure quiz performance, not total understanding.
4. **Scanned PDFs** need OCR first. Complex layouts (tables, formulas, two columns) may extract poorly.
5. **Processing runs inside the upload request** (60 s limit). Very large PDFs should be split. If processing is interrupted, the file shows "Processing did not finish" after 2 minutes and can be uploaded again.
13. **The migration is not re-runnable.** Run it once on a fresh project.
14. **Quiz generation handles topics one after another.** Real-model time for 8 topics is unmeasured; prefer 4 topics or fewer in demos.
6. **Topic map uses a sample** of up to 60 passages, so minor topics in big courses may be missed. Students can edit the map, but adding a brand-new topic manually is not yet supported (rename/move/delete only).
7. **Rebuilding the topic map deletes linked quiz history** (with a confirmation).
8. **Students can read their own answer keys via the Supabase API** — only affects self-assessment honesty.
9. **No per-user rate limiting** in the app.
10. **Progress compares rating snapshots**, not raw accuracy on identical questions; questions differ between attempts.
11. **Prerequisites come from the AI's topic map** and are not validated by a teacher.
12. Fonts use system stacks (no web font), and English only.

## Future work

- Background ingestion queue (e.g. Supabase Edge Functions / Inngest) and OCR.
- Cross-encoder reranking and hybrid (keyword + vector) search.
- Separate server-only answer-key table.
- Spaced repetition per question, not just per topic.
- Teacher view to approve topic maps and prerequisites.
- Calibration study comparing gap ratings with real exam outcomes.
- Rate limiting (Upstash) and audit logging.
- Manual topic creation and merging.
