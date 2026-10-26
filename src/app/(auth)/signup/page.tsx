import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
export const metadata: Metadata = { title: "Create account" };

export default function Signup() {
  return (
    <>
      <h1 className="mb-5 font-display text-2xl">Create your account</h1>
      <AuthForm mode="signup" demoEnabled={process.env.DEMO_LOGIN_ENABLED === "true"} />
    </>
  );
}
