# Run Instructions

Follow these steps in order. Total time: about 20 minutes the first time.

## 1. What you need

| Tool | Version | Get it |
|---|---|---|
| Node.js | 20.9 or newer (22 LTS recommended) | https://nodejs.org |
| Git | any | https://git-scm.com |
| Supabase account | free tier is enough | https://supabase.com |
| AI API key | Gemini free tier, or OpenAI (paid) | https://aistudio.google.com/apikey |

Check Node: `node -v`

## 2. Install

**Windows PowerShell**
```powershell
cd GapFinder-AI
npm install
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cd GapFinder-AI
npm install
cp .env.example .env.local
```

## 3. Create the Supabase project

1. Supabase dashboard → **New project**. Save the database password.
2. **Project Settings → API**: copy **Project URL** and **anon public** key into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
3. Copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` (only used by the demo-seed script; never put it in a `NEXT_PUBLIC_` variable).
4. **SQL Editor → New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**. You should see "Success. No rows returned".
5. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (later your Vercel URL)
   - Redirect URLs: add `http://localhost:3000/auth/callback`
6. Optional for quick local testing: **Authentication → Providers → Email** → turn off "Confirm email" so sign-up logs you in immediately.

## 4. Add the AI key

**Gemini (free tier, default in `.env.example`)**: create a key at https://aistudio.google.com/apikey and set `AI_API_KEY`. Keep the other `AI_*` values as they are.

**OpenAI instead**: set
```
AI_BASE_URL=https://api.openai.com/v1
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=768
```
`AI_EMBEDDING_DIMENSIONS` must stay **768** unless you also change `vector(768)` in the migration.

## 5. Run

```bash
npm run dev
```
Open http://localhost:3000 → **Create account** → on the Today page click **Load the sample PLC course**.

## 6. Optional: shared demo account (for judges)

In `.env.local` set `DEMO_EMAIL`, a strong `DEMO_PASSWORD` (12+ characters) and `DEMO_LOGIN_ENABLED=true`, then:

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```
PowerShell uses the same command. A "Sign in to the shared demo account" button appears on the login page. The password stays on the server.

## 7. Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify        # all four in order
```

End-to-end (needs a running app):
```bash
npx playwright install chromium     # once
npm run test:e2e                     # builds, starts and tests the app
```
Set `E2E_EMAIL` and `E2E_PASSWORD` (a dedicated test account) to also run the full student workflow test. PowerShell: `$env:E2E_EMAIL="..."; $env:E2E_PASSWORD="..."; npm run test:e2e`

## 8. Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "GapFinder AI"
   git branch -M main
   git remote add origin https://github.com/<you>/gapfinder-ai.git
   git push -u origin main
   ```
   `.gitignore` already excludes `.env.local`. Run `git status` before committing and make sure no `.env*` file except `.env.example` is listed.
2. https://vercel.com → **Add New → Project** → import the repo. Framework: Next.js (auto-detected).
3. **Environment Variables**: add every variable from `.env.local` **except** `SUPABASE_SERVICE_ROLE_KEY` (not needed at runtime).
4. Deploy. Then in Supabase **Authentication → URL Configuration** set Site URL to your Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to Redirect URLs.
5. Note: route handlers set `maxDuration = 60`. On the Vercel Hobby plan, keep uploads small (a few MB) so processing finishes in time.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Setup needed" screen | Supabase env vars missing | Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, restart `npm run dev` |
| "The AI provider is not configured" | `AI_*` missing or invalid | Check `.env.local`, restart |
| "rejected the API key" | Wrong key or wrong `AI_BASE_URL` for that key | Gemini keys need the Gemini base URL |
| "Embedding size ... does not match" | Model returns a different vector size | Use `AI_EMBEDDING_DIMENSIONS=768` with a model that supports it |
| "rate-limiting requests" | Free-tier quota | Wait a minute; quiz fewer topics at once |
| `relation "public.documents" does not exist` | Migration not run | Run `0001_init.sql` in the SQL editor |
| `relation "documents" already exists` | Migration run twice | It only needs to run once. To start over: Supabase → Database → reset, or a new project |
| `type "vector" does not exist` | pgvector off | The migration enables it; run it as the project owner in the SQL editor |
| Sign-up says "check your inbox" | Email confirmation on | Confirm the email, or turn confirmation off (step 3.6) |
| Email link goes to wrong site | Redirect URL not set | Step 3.5 |
| `npm install` fails with ERESOLVE | Old npm | Update Node/npm; or `npm install --legacy-peer-deps` |
| PDF upload: "could not be read" | Encrypted or damaged PDF | Export it again or upload text |
| PDF upload: "No readable text" | Scanned images | Run OCR first, or upload a text version |
| Page shows "This page could not load" | Database unreachable | Check Supabase project is not paused (free projects pause after inactivity) |
