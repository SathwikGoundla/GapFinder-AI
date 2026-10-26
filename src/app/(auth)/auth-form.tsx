"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { signIn, signUp, demoSignIn, type AuthState } from "./actions";

export function AuthForm({ mode, next, demoEnabled, expired }: { mode: "login" | "signup"; next?: string; demoEnabled: boolean; expired?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, {});
  const [demoState, demoAction, demoPending] = useActionState<AuthState, FormData>(() => demoSignIn(), {});
  return (
    <div className="space-y-5">
      {expired && <Notice tone="warning" title="Your session expired">Sign in again to continue. Your saved work is kept.</Notice>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        {mode === "signup" && (
          <div>
            <label htmlFor="fullName" className="label">Full Name</label>
            <input id="fullName" name="fullName" type="text" required autoComplete="name" minLength={2} maxLength={100} placeholder="Alex Taylor" className="field" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} className="field" />
        </div>
        {state.error && <p role="alert" className="text-sm text-weak">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-strong">{state.message}</p>}
        <Button type="submit" busy={pending} className="w-full">{mode === "login" ? "Sign in" : "Create account"}</Button>
      </form>
      {demoEnabled && (
        <form action={demoAction} className="border-t border-line pt-5">
          <Button type="submit" variant="secondary" busy={demoPending} className="w-full">Sign in to the shared demo account</Button>
          <p className="mt-2 text-xs text-ink-faint">The demo account is shared. Don&apos;t upload anything private to it.</p>
          {demoState.error && <p role="alert" className="mt-2 text-sm text-weak">{demoState.error}</p>}
        </form>
      )}
      <p className="text-center text-sm text-ink-soft">
        {mode === "login" ? <>New here? <Link className="text-accent underline-offset-2 hover:underline" href="/signup">Create an account</Link></>
          : <>Already have an account? <Link className="text-accent underline-offset-2 hover:underline" href="/login">Sign in</Link></>}
      </p>
    </div>
  );
}
