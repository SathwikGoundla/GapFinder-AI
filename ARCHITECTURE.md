# Architecture

One Next.js application. No separate backend, no agent framework, no microservices — a 7-hour build should be small enough to explain completely.

## Diagram

```
 Browser (React, Tailwind)
   │  pages: Today · Materials · Topic map · Quiz · Gap report · Plan · Progress · Ask
   │  (never receives: correct answers before submit, API keys, service-role key)
   ▼
 Next.js on Vercel
 ├─ middleware.ts ............ refreshes Supabase session, redirects signed-out users
 ├─ Server Components ........ read data with the user's session (RLS applies)
 ├─ Route Handlers /api/* .... requireUser() → validate input (Zod) → service → JSON
 └─ src/lib
     ├─ ingest/   validate → extract (unpdf) → normalize → chunk        [deterministic]
     ├─ rag/      retrieve (pgvector) → filter → validateCitation        [deterministic]
     ├─ ai/       provider (timeouts, bounded retries) + schemas + prompts [generation]
     ├─ eval/     MCQ exact match | short answer → AI semantic grading
     ├─ scoring/  gap formula (weak/developing/strong/insufficient)     [deterministic]
     ├─ planner/  prioritise + schedule                                 [deterministic]
     └─ services/ glue: documents, topics, quiz, report, plans, assistant
   │                                   │
   ▼                                   ▼
 Supabase                         AI provider (OpenAI-compatible API)
 Postgres + pgvector + Auth       chat: questions, grading, topic map, objectives, explanations
 RLS on every table               embeddings: chunk + query vectors
```

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| Next.js route handlers, no Python backend | One language, one deploy, easy to explain | Heavy ML would need another service later |
| Supabase (Postgres + pgvector + Auth) | Auth, RLS and vector search in one free-tier service | Vendor dependency |
| OpenAI-compatible HTTP client written by hand | Works with Gemini (free) and OpenAI; no SDK lock-in; easy to mock | We maintain ~120 lines of client code |
| Rule-based gap scoring | Explainable, repeatable, testable; AI can't invent a mastery score | Less nuanced than a learned model |
| Deterministic scheduler, AI only writes objectives | Plan is predictable and testable | Objectives text varies between runs |
| Synchronous ingestion inside the upload request | Simple; no queue to run | Limited by function timeout (60 s) — large PDFs should be split |
| Original files are not stored, only extracted text | Less private data kept; no storage bucket to secure | Can't re-process the original file later |
| Pinned Next 15.5 / Zod 3 / Tailwind 3 | Stable, well-known APIs for a time-boxed build | Not the newest majors (Next 16, Zod 4, Tailwind 4) |
| System font stacks | Builds offline; no external font requests | Less typographic control |
| shadcn-style components written by hand (cva + tailwind-merge) | shadcn registry was not reachable from the build environment; same pattern | Fewer ready-made components |

## Request flow example: submitting a quiz

1. `POST /api/quiz/:id/submit` → `requireUser()` (401 if expired) → Zod validates answers.
2. Session ownership checked; status atomically changed `in_progress → submitted` (a second submit is a no-op).
3. MCQs graded by exact match; short answers graded by AI. If grading fails, that answer is stored as "not counted" — the rest are kept.
4. Answers saved (unique per question), then `recordAssessments()` snapshots each topic's rating for progress history.
