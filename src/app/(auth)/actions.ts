"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface AuthState { error?: string; message?: string }
const creds = z.object({ email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.") });
const signupCreds = z.object({
  fullName: z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(100, "Name must be under 100 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupCreds.safeParse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your inbox to confirm your email, then sign in." };
  redirect("/dashboard");
}

/** Demo sign-in happens on the server; the demo password never reaches the browser. */
export async function demoSignIn(): Promise<AuthState> {
  if (process.env.DEMO_LOGIN_ENABLED !== "true" || !process.env.DEMO_EMAIL || !process.env.DEMO_PASSWORD) {
    return { error: "The demo account is not enabled on this deployment." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
  if (error) return { error: "The demo account could not sign in. Run scripts/seed-demo.mjs (see DEMO_GUIDE.md)." };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
