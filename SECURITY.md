# Security

| Risk | Protection |
|---|---|
| Reading another user's data | Server checks the session on every API call (`requireUser`), explicit ownership checks before writes (`assertOwner`), **and** Postgres RLS on all tables; vector search function runs as the caller |
| Leaked secrets | Keys only in env vars; only `NEXT_PUBLIC_SUPABASE_URL` and the anon key reach the browser; service-role key used only by a local script; client bundle scanned for secret names during verification; `.env*` git-ignored |
| Demo password exposure | Demo sign-in is a Server Action; the password never reaches the browser; disabled unless `DEMO_LOGIN_ENABLED=true` |
| Malicious uploads | Size limit (also checked from `Content-Length`), extension + MIME + magic-byte check, strict UTF-8 decoding, PDF parsed with pdf.js in a server function, max 400 chunks per document, original file not stored |
| Bad input | Zod schemas on all API bodies (UUIDs, lengths, ranges, dates) |
| Seeing answers early | Quiz page selects only safe columns while a quiz is in progress |
| Duplicate records | Unique keys: document hash, quiz idempotency key, one answer per question; atomic status change on submit |
| Error leakage | Unknown errors return a generic message; logs record only error name + truncated message, never document text |
| Open redirect after login | `next` parameter must be a same-site path |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy |
| Prompt injection inside uploaded documents | Evidence is wrapped in tagged blocks; outputs are schema-validated and citations verified. This **reduces** but does not fully prevent manipulation of AI text by document content |

## Known gaps

- A student can read their own questions' answers directly through the Supabase API (RLS allows owners to read their rows). This only lets someone cheat on their own self-diagnosis. Moving answers to a separate server-only table would close it.
- No application-level rate limiting per user. AI provider quotas and Vercel limits apply. Add Upstash/Redis rate limiting before a public launch.
- The shared demo account is shared: anyone with access sees the same data.
