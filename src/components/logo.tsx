import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="9" height="9" rx="2" fill="#2F7D5B" />
        <rect x="12" y="1" width="9" height="9" rx="2" fill="#A86B12" />
        <rect x="1" y="12" width="9" height="9" rx="2" fill="#1A2240" />
        <rect x="12.75" y="12.75" width="7.5" height="7.5" rx="2" fill="none" stroke="#B4372F" strokeWidth="1.5" />
      </svg>
      GapFinder
    </Link>
  );
}
