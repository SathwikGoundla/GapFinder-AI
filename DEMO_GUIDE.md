# Demo Guide

## Before judging (once)

1. Complete RUN_INSTRUCTIONS.md steps 1–5.
2. Set `DEMO_EMAIL`, a strong `DEMO_PASSWORD`, `DEMO_LOGIN_ENABLED=true`; run `node --env-file=.env.local scripts/seed-demo.mjs`.
3. Sign in with the demo button → **Load the sample PLC course** → **Build topic map**. Do this before the demo; it takes ~1 minute.
4. Optional: take one quiz in advance and answer a few questions wrongly on purpose, so the gap report has something to show. This is real quiz data, not fabricated history.

The sample course (`sample-data/`) is original demo content written for this project: a syllabus, study notes and a past paper on PLC fundamentals (scan cycle, ladder logic, timers, counters, safety). It is labelled "Demo content" in the app.

The demo account is shared. Use **Settings → Delete all study data** to reset it.

## 2-minute script

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page | "Students revise everything equally because they can't see their own gaps. GapFinder finds them from the student's own materials." |
| 0:15 | Materials | "Syllabus, notes, past paper. Text is extracted page by page and indexed for search." |
| 0:25 | Topic map | "Topics from the materials. 'In syllabus' is only allowed if a real syllabus passage backs it — the app checks, not the AI." |
| 0:40 | Start quiz → one question | "Each question is written from one passage. Correct answers never reach the browser before submit." |
| 0:55 | Submit → results | "MCQs are graded by exact match; short answers by AI for meaning. Every result shows the source quote and page. Questions whose quote didn't match the source were thrown out." |
| 1:15 | Gap report | "This is the core screen. Each square is one answer. Ratings come from a fixed formula, not the AI. One answer shows 'Not enough evidence' instead of pretending." |
| 1:35 | Plan | "Exam date and daily time in; weak topics and their prerequisites come first, with a spaced second pass. After a new quiz, the plan flags itself as outdated." |
| 1:45 | Mark a plan session done → Progress | "Progress shows real attempt history, nothing pre-filled." |
| 1:50 | Ask your notes: "What happens during the input scan?" then "What is the tax rate in France?" | "Supported answers quote the notes. For the second, it says the notes don't cover it instead of guessing." |

**Do not** demo with more than 4 quiz topics (keeps generation fast).
