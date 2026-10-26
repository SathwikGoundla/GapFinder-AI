# Build and Verification Report

Date: 26 Oct 2026. Every PASS below was actually executed. Nothing marked PASS was simulated.

## Overall status

| Area | Status |
|---|---|
| P0 checks (workflow, data consistency, auth, RLS, secrets, build) | **PASS** (on local stack, see "How it was tested") |
| Real AI provider (Gemini/OpenAI) | **UNVERIFIED** — no key, and provider hosts were unreachable from the build sandbox |
| Security (auth, RLS, secrets) | **PASS** |
| Deployment (Vercel + hosted Supabase) | **UNVERIFIED** — no account access |
| Demo | **NOT READY until the 30-minute real-key check below passes** |

## How it was tested

Hosted Supabase and AI provider hosts were blocked from the sandbox, so a local Supabase-equivalent stack was built:
Postgres 16 + pgvector 0.6, **Supabase Auth (GoTrue v2.177.0)**, PostgREST v12.2, a proxy with Supabase's `/auth/v1` + `/rest/v1` URLs, and the project's migration applied **unchanged**.
AI calls went to a **test-only stub** speaking the same OpenAI-compatible API (it can also simulate failures). The stub is not part of this project. For the stub run only, `RAG_MIN_SIMILARITY=0.1` because its word-hash embeddings score lower than real models; the shipped default (0.55) is untested with a real model.

## Verified (executed)

**Static checks — clean folder from this ZIP's contents, `npm ci` then `npm run verify`, no secrets set**
- `npm ci`: PASS (435 packages, 19 s)
- TypeScript strict: PASS (0 errors)
- ESLint, 0 warnings allowed: PASS
- Unit tests: PASS (60/60, 7 files)
- Production build: PASS (one third-party warning, see Remaining risks)

**Browser workflow (production build, real database, fresh user) — 21/21 PASS**
Sign up → load sample course → upload PDF → duplicate upload rejected → fake PDF rejected → build topic map (syllabus vs inferred enforced) → generate quiz → answers absent from page before submit → answer/leave blanks → submit → results with source citations → re-submit is a no-op → gap report → create plan → mark session done → Today focus card → progress → assistant answer with verified quote (fabricated stub claim removed) → retest → plan flagged outdated → progress shows 2 attempts → mobile menu.
Only console/network errors: the deliberate 409 (duplicate) and 400 (fake PDF).

**Data consistency (SQL after runs) — PASS:** 0 sessions with missing answers, 0 duplicate answers, 0 users with >1 active plan, 0 questions citing another user's chunk, 0 stuck uploads, 0 submitted quizzes without a progress snapshot. Double-clicked quiz creation → 1 session.

**Auth — PASS:** sign up, sign in (button and Enter key), refresh keeps session, sign out → protected page redirects and API returns 401; no session → 401 on all 5 AI/write routes; forged session cookie → 401.

**RLS / authorization (user B with a real JWT against user A's data) — PASS:** 0 rows readable in all 10 tables; insert as A → 403; update/delete A's rows → no effect; vector search returns none of A's chunks; anon key reads nothing; app API returns 404 for A's document/topic/quiz; A's quiz page shows "not found".

**Invalid input — PASS:** empty file 400, whitespace-only file 422, fake PDF 400, unsupported type 400, bad UUID / missing fields / bad date / exam date today / minutes < 15 / short question → 400 with a clear message.

**AI failure behaviour (stub) — PASS**

| Case | Result |
|---|---|
| 429 | 429, 3 attempts, ~2.4 s, clear message |
| 500 / 502 | 502, 3 attempts, ~2.5 s |
| Invalid key (401) | 503, 1 attempt (not retried) |
| Timeout (provider hangs) | 504 after **20.2 s**, 1 attempt |
| Malformed JSON / truncated / empty | 502, not retried, nothing shown |
| AI down during upload | document marked failed with reason; re-upload works |
| AI down during grading | quiz still submits; MCQs graded; short answers "not counted" |
| Question not in materials | refused, no AI call made |

**Secrets — PASS:** actual secret values (service key, JWT secret, AI key, demo password) absent from the client bundle; secret variable names absent; no key-like strings in source; Git would track only `.env.example`; `.env.local` matched by `.gitignore`.

**Visual / accessibility — PASS (light check):** 9 screens desktop + mobile, no horizontal overflow; keyboard tab order on login is skip-link → logo → email → password → sign in; 0 unlabeled controls on login.

## Fixed during the audit

| Problem | Evidence | Fix | Verified by |
|---|---|---|---|
| Plan saved but screen still showed empty form | API 200 + row in DB, UI unchanged; server payload correct | Full navigation to `/plan` after save | Create + rebuild, repeated runs |
| Same issue on fast quiz submit | All-blank retest: DB submitted, UI stuck | Full navigation to results | Workflow retest step |
| AI timeout took 138 s (> 60 s serverless limit) | Measured | 20 s per call, timeouts not retried | Measured 20.2 s; unit test |
| Interrupted upload stuck "Processing" and blocked re-upload | Follows from the 60 s kill | Rows processing > 2 min can be re-uploaded; UI explains | Live: stuck row → re-upload → ready |
| Interrupted quiz with 0 questions would crash the runner | Code path | Guard message + "Start a new quiz" | Live |
| Favicon 404 in console | Console log | Added `src/app/icon.svg` | No console errors |

## Remaining risks

1. Real AI not exercised: question quality, grading accuracy, JSON reliability, latency, and whether real quotes pass the 80% citation check.
2. `RAG_MIN_SIMILARITY=0.55` untested with real embeddings: too high → "not enough evidence" everywhere; too low → weaker evidence.
3. Quiz generation is sequential per topic; real-model time for 8 topics unknown. Demo with ≤4 topics.
4. Build warning from `@supabase/realtime-js` in Edge middleware (unused module). No functional impact observed.
5. The migration is not re-runnable.
6. Students can read their own answer keys through the Supabase API (self-assessment only).
7. No per-user rate limiting.

## Unverified

Real AI provider · hosted Supabase (email confirmation, redirect URLs) · Vercel deployment and real function limits · natural token expiry/refresh · full Playwright run on a real deployment.

## Manual actions (about 30 minutes)

1. Create a Supabase project → SQL Editor → run `supabase/migrations/0001_init.sql` once.
2. `cp .env.example .env.local`; add the Supabase URL, anon key and a Gemini key (https://aistudio.google.com/apikey).
3. `npm ci && npm run dev` → sign up → **Load the sample PLC course** → **Build topic map** → quiz on 4 topics. **Write down the time** each step takes.
4. Check 3–4 questions: do they make sense, and does each source quote really appear in the notes?
5. Answer one short question correctly in different words → should be "Correct".
6. Assistant: "What happens during the input scan?" (should answer with quotes) and "What is the tax rate in France?" (should refuse).
7. If step 3 says "not enough evidence" for most topics, lower `RAG_MIN_SIMILARITY` to 0.45 and retry once.
8. Deploy (below), then repeat step 3 on the live URL.
9. Before pushing: `git status` must not list `.env.local`.

## Demo flow (2 minutes)

Sign in → Materials (sample course) → Topic map → start quiz (≤4 topics) → submit → results with source quotes → Gap report (evidence strip, "Not enough evidence") → Revision plan → mark a session done → Progress → Assistant: supported question → unsupported question (safe refusal). Full script: DEMO_GUIDE.md.

## Deployment

1. `git init && git add . && git commit -m "GapFinder AI"` → push to GitHub.
2. Vercel → import repo → add all env vars from `.env.local` **except** `SUPABASE_SERVICE_ROLE_KEY`.
3. Supabase → Authentication → URL Configuration: Site URL = Vercel URL; add `https://<app>.vercel.app/auth/callback`.
4. Optional demo account: set `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_LOGIN_ENABLED=true`, run `node --env-file=.env.local scripts/seed-demo.mjs` locally, and add the same three vars in Vercel.
