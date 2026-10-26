# Testing

## Commands

```bash
npm run typecheck   # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint        # eslint, zero warnings allowed
npm test            # vitest unit tests (no network, no database)
npm run build       # production build
npm run verify      # all of the above, in order
npm run test:e2e    # Playwright (see RUN_INSTRUCTIONS.md)
```

## Unit tests (60 tests, 7 files)

| File | Covers |
|---|---|
| `tests/ingest.test.ts` | PDF signature check, fake PDF rejection, size/type/empty/binary rejection, per-page PDF extraction (real fixture), corrupt PDF, empty and invalid-UTF-8 text, normalization, heading detection, chunk page/section metadata, no page crossing, sample notes chunking |
| `tests/rag.test.ts` | Valid citation, whitespace-tolerant matching, fabricated chunk id, real chunk with wrong quote, similarity threshold, overlap de-duplication, per-document cap |
| `tests/ai.test.ts` | Missing config, timeout not retried, fenced JSON, schema mismatch, truncated output, bounded retries (429/503 → success), retry limit, no retry on 401, embedding batch + dimension check, question acceptance/rejection, assistant claim verification |
| `tests/eval.test.ts` | MCQ grading, blank/exact-match short answers without AI, semantically equivalent answer accepted, ambiguous verdict |
| `tests/scoring.test.ts` | Insufficient evidence with 1 answer, weak, 3-answer rule for strong, blanks, ambiguous exclusion, recency weighting + conflict flag, determinism, weak prerequisites |
| `tests/planner.test.ts` | Prerequisite ordering, reasons, daily limit, free day before exam, spaced second pass, past exam date, adaptation after improvement |
| `tests/security.test.ts` | API input validation, protected routes, ownership check, RLS present on every table, no internal error leakage, no real secrets in `.env.example`, syllabus-origin enforcement |

External AI calls are replaced by an in-test fake `fetch` (`tests/helpers.ts`). This mock exists only in `tests/`; the application has no fallback or mock AI path.

## End-to-end (`e2e/workflow.spec.ts`)

- Public: landing renders, protected page redirects to sign-in, API returns 401 without a session.
- Full workflow (needs real Supabase + AI + `E2E_EMAIL`/`E2E_PASSWORD`): clears data → loads sample course → builds topic map → generates quiz → answers and submits → checks results show sources → gap report → creates plan. **Uses real AI calls and spends API quota.**

To use an existing Chrome instead of downloading Playwright's browser: set `PW_CHROME_PATH`. To test an already running server: set `E2E_BASE_URL`.
