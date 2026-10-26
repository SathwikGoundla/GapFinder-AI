// Creates (or resets the password of) the shared demo user.
// Run once:  node --env-file=.env.local scripts/seed-demo.mjs
// Needs SUPABASE_SERVICE_ROLE_KEY. This script runs on your machine only; the key is never sent to the browser.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL or DEMO_PASSWORD in .env.local");
  process.exit(1);
}
if (password.length < 12 || password.includes("change-me")) {
  console.error("Choose a real DEMO_PASSWORD of at least 12 characters.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error("Could not list users:", listErr.message); process.exit(1); }
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Demo user ${email} already existed — password updated.`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Demo user ${email} created.`);
}
console.log("Set DEMO_LOGIN_ENABLED=true to show the demo sign-in button. Sign in, then click 'Load the sample PLC course'.");
