# GapFinder AI

**Know your gaps. Revise with purpose.**

Students usually revise everything equally, and they can't always tell what they don't understand. GapFinder AI reads a student's own course materials, quizzes them on it, shows which topics are weak **and the exact answers that prove it**, then builds a revision plan around those gaps.

## The core loop

Upload materials → map topics → evidence-grounded quiz → evaluate answers → gap report → revision plan → retest → see progress → plan adapts.

## What makes it different

| Typical study chatbot | GapFinder AI |
|---|---|
| Waits for you to ask | Diagnoses gaps proactively |
| AI decides your "score" | AI grades single answers; a **fixed, documented formula** rates each topic |
| Citations may be invented | Every cited quote is **checked against the real passage** before it's shown |
| One answer = "you know it" | Small samples are shown as **"Not enough evidence"** |

## Features

- **Materials** — PDF, .txt and .md upload (10 MB max), signature-checked, page-aware extraction, duplicate detection. Includes an original sample PLC course.
- **Topic map** — hierarchy with prerequisites; "In syllabus" vs "Found in notes" is enforced by the app; students can rename/move/delete topics.
- **Diagnostic quiz** — MCQ + short answer, each with a verified source quote, page and section. Answers are never sent to the browser before submission.
- **Answer evaluation** — MCQs by exact match; short answers graded by AI for meaning, with a "not counted" state for ambiguous answers.
- **Gap report** (signature screen) — weak / developing / strong / not enough evidence, an evidence strip per topic, confidence, and every answer behind the rating.
- **Revision plan** — scheduled by exam date and daily minutes; weak and prerequisite topics first; spaced second passes; marks plans as outdated after a new quiz.
- **Progress** — real per-attempt rating history; "Not enough data" when attempts aren't comparable.
- **Ask your notes** — retrieval-grounded explanations; unverifiable statements are removed; inferences are labelled.
- **Auth & privacy** — Supabase Auth, server-side checks on every request, row-level security on every table.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 3 · Supabase (Postgres + pgvector + Auth) · any OpenAI-compatible AI provider (default: Google Gemini free tier) · Vitest · Playwright · Vercel.

## Quick start

See **[RUN_INSTRUCTIONS.md](RUN_INSTRUCTIONS.md)**. Short version:

```bash
npm install
cp .env.example .env.local      # fill in Supabase + AI keys
# run supabase/migrations/0001_init.sql in the Supabase SQL editor
npm run dev
```

## Documentation

| File | What it covers |
|---|---|
| [RUN_INSTRUCTIONS.md](RUN_INSTRUCTIONS.md) | Setup, commands, troubleshooting |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, diagram, key decisions |
| [RAG_PIPELINE.md](RAG_PIPELINE.md) | Extraction, chunking, embeddings, retrieval, citation checks |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | What the AI does vs what the code decides; scoring formula |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables and access control |
| [SECURITY.md](SECURITY.md) | Threats and protections |
| [TESTING.md](TESTING.md) | Test suites and commands |
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Demo account and 2-minute script |
| [LIMITATIONS_AND_FUTURE_WORK.md](LIMITATIONS_AND_FUTURE_WORK.md) | Honest limits |
| [BUILD_AND_VERIFICATION_REPORT.md](BUILD_AND_VERIFICATION_REPORT.md) | What was actually run, and results |
