import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReport } from "@/lib/services/report";
import { prioritize } from "@/lib/planner/plan";
import { SCORING, type GapStatus } from "@/lib/scoring/gap";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/notice";
import { ConfidenceNote, EvidenceStrip, STATUS_META, StatusBadge } from "@/components/ui/status";
import { formatSource } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Gap report" };
const FILTERS: (GapStatus | "all")[] = ["all", "weak", "developing", "strong", "insufficient"];
const VERDICT_TEXT = { correct: "Correct", partial: "Partly correct", incorrect: "Incorrect", unanswered: "Left blank", ambiguous: "Not counted" } as const;

export default async function Report({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const report = await loadReport(await createClient());
  if (report.sessions === 0) {
    return <><PageHeader title="Gap report" /><EmptyState title="No quiz results yet" action={<Link href="/quiz" className={buttonStyles()}>Take a diagnostic quiz</Link>}>
      The report is built only from your quiz answers. Nothing is guessed before you&apos;ve answered questions.
    </EmptyState></>;
  }
  const filter = (FILTERS as string[]).includes(sp.show ?? "") ? (sp.show as GapStatus | "all") : "all";
  const order = prioritize(report.topics, report.topics.map((t) => t.gap));
  const rows = order.map((o) => report.topics.find((t) => t.id === o.topic.id)!).filter((t) => filter === "all" || t.gap.status === filter);
  const count = (s: GapStatus) => report.topics.filter((t) => t.gap.status === s).length;
  const weak = report.topics.filter((t) => t.gap.status === "weak").map((t) => t.name);

  return (
    <>
      <PageHeader title="Gap report"
        description={weak.length
          ? <>Your biggest gaps are in <strong className="text-ink">{weak.slice(0, 3).join(", ")}</strong>{weak.length > 3 ? ` and ${weak.length - 3} more` : ""}. Each topic below shows the answers behind its rating.</>
          : <>No topic is currently weak. Check topics with too little evidence before trusting the result.</>}
        actions={<Link href="/plan" className={buttonStyles()}>Plan my revision</Link>} />

      <nav aria-label="Filter topics" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/report" : `/report?show=${f}`} aria-current={filter === f ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", filter === f ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-soft hover:border-ink-faint")}>
            {f === "all" ? `All ${report.topics.length}` : `${STATUS_META[f].label} ${count(f)}`}
          </Link>
        ))}
      </nav>

      <ul className="space-y-3">
        {rows.map((t) => (
          <li key={t.id} id={`t-${t.id}`} className={cn("panel scroll-mt-24 border-l-4", STATUS_META[t.gap.status].border)}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg">{t.name}</h2>
                    <StatusBadge status={t.gap.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{t.gap.reasons[0]}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <EvidenceStrip verdicts={t.evidence.map((e) => e.verdict)} label={`${t.evidence.length} answers: ${t.gap.counts.correct} correct, ${t.gap.counts.incorrect} incorrect`} />
                  <ConfidenceNote confidence={t.gap.confidence} answers={t.gap.counts.answered + t.gap.counts.unanswered} />
                  <span className="text-xs text-accent group-open:hidden">Show evidence</span>
                </div>
              </summary>
              <div className="border-t border-line px-5 pb-5 pt-4">
                {t.gap.reasons.length > 1 && <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">{t.gap.reasons.slice(1).map((r, i) => <li key={i}>{r}</li>)}</ul>}
                {t.gap.mastery != null && <p className="mb-4 text-sm text-ink-faint">Estimated mastery {(t.gap.mastery * 100).toFixed(0)}% from quiz answers (not a prediction of exam marks).</p>}
                {t.evidence.length === 0 ? <p className="text-sm text-ink-soft">Not quizzed yet.</p> : (
                  <ul className="space-y-3">
                    {t.evidence.map((e) => (
                      <li key={e.question_id} className="text-sm">
                        <p><span className="font-medium">{VERDICT_TEXT[e.verdict]}</span> <span className="text-ink-faint">· {fmtDate(e.submitted_at)}</span></p>
                        <p className="mt-0.5">{e.prompt}</p>
                        <p className="mt-0.5 text-ink-soft">{e.feedback}</p>
                        {e.source && <p className="mt-0.5 text-xs text-ink-faint">Source: {formatSource(e.source)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/quiz?topics=${t.id}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>Retest</Link>
                  <Link href={`/assistant?topic=${t.id}`} className={buttonStyles({ size: "sm", variant: "ghost" })}>Explain from my notes</Link>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <details className="mt-10 rounded-lg border border-line bg-surface p-5 text-sm">
        <summary className="cursor-pointer font-medium">How ratings are calculated</summary>
        <div className="prose-measure mt-3 space-y-2 text-ink-soft">
          <p>The AI only grades individual short answers. The rating itself is a fixed formula, so the same answers always give the same result.</p>
          <p>Each answer scores 1 (correct), 0.5 (partly correct) or 0 (incorrect or blank). Answers marked &ldquo;not counted&rdquo; are left out. Older quizzes count less: each earlier attempt is weighted ×{SCORING.decay}.</p>
          <p>Mastery = (weighted score + 1) ÷ (weighted answers + 2). The +1/+2 keeps one lucky answer from looking like mastery.</p>
          <p>Below {SCORING.weakBelow * 100}% is weak, below {SCORING.strongAtOrAbove * 100}% is developing, and above that is strong — but strong needs at least {SCORING.strongMinAnswers} answers. Fewer than {SCORING.minEvidence} scored answers means not enough evidence.</p>
        </div>
      </details>
    </>
  );
}
