import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EvidenceStrip, StatusBadge } from "@/components/ui/status";
import { Logo } from "@/components/logo";

const STEPS = [
  ["Upload your materials", "Syllabus, notes, chapters and past papers. PDF or text."],
  ["Take a diagnostic quiz", "Every question is written from a passage in your own materials and cites it."],
  ["See your gaps, with evidence", "Each topic is marked weak, developing or strong — and shows the answers that put it there."],
  ["Follow a plan, then retest", "Weak and prerequisite topics come first. Your plan updates after each attempt."],
] as const;

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex gap-2">
          <Link href="/login" className={buttonStyles({ variant: "ghost" })}>Sign in</Link>
          <Link href="/signup" className={buttonStyles({ variant: "primary" })}>Create account</Link>
        </nav>
      </header>

      <main id="main" className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
        <section>
          <h1 className="font-display text-4xl leading-[1.08] sm:text-6xl">Know your gaps.<br />Revise with purpose.</h1>
          <p className="prose-measure mt-6 text-lg text-ink-soft">
            Most students revise everything equally. GapFinder quizzes you on your own course materials,
            shows exactly which topics you don&apos;t understand yet and why, then builds a revision plan around them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonStyles({ size: "lg" })}>Start with your materials</Link>
            <Link href="/login?demo=1" className={buttonStyles({ size: "lg", variant: "secondary" })}>Try the demo course</Link>
          </div>
        </section>

        {/* A real example of the gap report row, not a mock statistic. */}
        <figure className="panel p-5 shadow-lift" aria-label="Example gap report">
          <figcaption className="mb-4 text-sm text-ink-faint">Illustration of how a gap report reads (not real results)</figcaption>
          {[
            { name: "Scan cycle", status: "weak" as const, v: ["incorrect", "unanswered", "partial"] as const, why: "Missed that inputs are read once per scan." },
            { name: "Seal-in circuits", status: "developing" as const, v: ["correct", "partial", "incorrect", "correct"] as const, why: "Knows the parallel contact; unsure why stop is in series." },
            { name: "Timers (TON / TOF)", status: "strong" as const, v: ["correct", "correct", "correct", "partial"] as const, why: "Consistent across two attempts." },
            { name: "Counters", status: "insufficient" as const, v: ["correct"] as const, why: "One answer is not enough to judge." },
          ].map((r) => (
            <div key={r.name} className="border-t border-line py-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{r.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">{r.why}</span>
                <EvidenceStrip verdicts={[...r.v]} label={`${r.v.length} answers`} />
              </div>
            </div>
          ))}
        </figure>
      </main>

      <section className="border-t border-line bg-surface">
        <ol className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="font-display text-2xl text-accent">{i + 1}</span>
              <h2 className="mt-2 font-medium">{t}</h2>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-faint">
        GapFinder AI gives study guidance, not guarantees. AI-generated questions and feedback can contain mistakes — every one links to its source so you can check.
      </footer>
    </div>
  );
}
