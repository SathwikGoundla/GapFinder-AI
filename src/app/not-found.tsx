import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-2 text-ink-soft">It may have been deleted, or it belongs to a different account.</p>
      <Link href="/dashboard" className={buttonStyles({ className: "mt-6" })}>Go to Today</Link>
    </main>
  );
}
