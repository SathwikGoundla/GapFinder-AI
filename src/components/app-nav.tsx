"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Today" },
  { href: "/library", label: "Materials" },
  { href: "/topics", label: "Topic map" },
  { href: "/quiz", label: "Diagnostic quiz" },
  { href: "/report", label: "Gap report" },
  { href: "/plan", label: "Revision plan" },
  { href: "/progress", label: "Progress" },
  { href: "/assistant", label: "Ask your notes" },
];

export function AppNav({ displayName, email }: { displayName?: string; email?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nameToShow = displayName || email || "Account";

  const links = (
    <ul className="space-y-0.5">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
              className={cn("block rounded px-3 py-2 text-sm", active ? "bg-accent-tint font-medium text-accent" : "text-ink-soft hover:bg-ink/5 hover:text-ink")}>
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <Logo href="/dashboard" />
        <nav aria-label="Main" className="mt-8 flex-1">{links}</nav>
        <Link href="/settings" className="truncate rounded px-3 py-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
          {nameToShow}
        </Link>
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo href="/dashboard" />
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" className="rounded px-3 py-1.5 text-sm font-medium hover:bg-ink/5">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="fixed inset-x-0 top-[57px] z-20 border-b border-line bg-paper px-4 pb-4 pt-2 shadow-lift lg:hidden">
          {links}
          <Link href="/settings" onClick={() => setOpen(false)} className="mt-2 block rounded px-3 py-2 text-sm text-ink-soft">
            Settings · {nameToShow}
          </Link>
        </nav>
      )}
    </>
  );
}
