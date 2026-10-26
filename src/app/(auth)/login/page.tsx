import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="mb-5 font-display text-2xl">Sign in</h1>
      <AuthForm mode="login" next={sp.next} expired={sp.expired === "1"} demoEnabled={process.env.DEMO_LOGIN_ENABLED === "true"} />
    </>
  );
}
