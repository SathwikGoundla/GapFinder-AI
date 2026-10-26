# AI Workflow

## Who decides what

| Responsibility | Done by | Where |
|---|---|---|
| Find passages | Retrieval (embeddings + pgvector) | `rag/retrieve.ts` |
| Write topic map | AI, then sanitized by code | `services/topics.ts` |
| Mark topic "in syllabus" | **Code** (needs a cited syllabus chunk) | `sanitizeTopicMap()` |
| Write questions | AI, from evidence blocks | `services/quiz.ts` |
| Accept/reject questions | **Code** (schema + citation check) | `acceptQuestions()` |
| Grade MCQ | **Code** (exact match) | `evaluateMcq()` |
| Grade short answers | AI (meaning, not wording), blank/exact-match handled by code first | `eval/evaluate.ts` |
| Topic rating | **Code** (formula below) | `scoring/gap.ts` |
| Revision schedule | **Code** | `planner/plan.ts` |
| Session objectives | AI (from recorded mistakes); falls back to quiz evidence | `services/plans.ts` |
| Explanations | AI, only verified claims shown | `services/assistant.ts` |
| Access control, validation, persistence | **Code + database RLS** | `auth.ts`, `validation.ts`, migration |

The AI never assigns a student's mastery level.

## Gap scoring formula

1. Each answer: correct = 1, partly correct = 0.5, incorrect = 0, blank = 0. "Ambiguous" (AI unsure) answers are **excluded**.
2. Recency weight: newest attempt ×1, previous ×0.6, the one before ×0.36, …
3. `mastery = (Σ weight×score + 1) / (Σ weight + 2)` — a Laplace prior; one lucky answer gives 0.67, not 1.0.
4. Status:
   - weighted answer count < 2 → **Not enough evidence**
   - mastery < 0.50 → **Weak**
   - mastery < 0.75 → **Developing**
   - mastery ≥ 0.75 and ≥ 3 answers → **Strong** (otherwise capped at Developing, with a reason)
5. Confidence: low (<3 answers), medium (3–5), high (6+); downgraded if the latest attempt differs from earlier ones by ≥40 points.
6. Reasons are generated from the counts, e.g. "1 correct, 0 partly correct, 2 incorrect, 0 blank out of 3", plus notes about excluded answers, conflicting attempts and weak prerequisites.

## Revision plan

- Priority = base (weak 3, developing 2, not enough evidence 1.5, strong 0.5) + 1 if it's a prerequisite of a weak/developing topic + (1 − mastery).
- Prerequisites are placed before the topics that depend on them.
- Weak topics get a 45-min "learn" session and a 30-min second pass **≥2 days later**; developing 35 min; not enough evidence 20-min "check"; strong 20-min review only if time remains.
- Daily minutes are never exceeded; the day before the exam is left free.
- **Adaptation**: each plan records the quiz it was based on. After a new quiz, Today and Plan show "plan is based on an older quiz"; updating archives the old plan (completed sessions stay) and rebuilds from the new ratings.

## Failure handling

- Timeout 20 s per AI call and a timed-out call is **not** retried (keeps requests under the 60 s serverless limit; measured 20.2 s in the audit). 429/5xx/network errors retry at most 3 times with backoff (~2.5 s). 401/403 are never retried.
- Truncated (`finish_reason=length`), non-JSON or schema-invalid output → clear error, nothing shown.
- Short-answer grading failure → that answer is "not counted"; the quiz still submits.
- Objective-writing failure → objectives come straight from quiz mistakes, labelled as such.
- If the AI is unavailable, the app says so. There is no fake fallback content.
