import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReport } from "@/lib/services/report";
import { prioritize } from "@/lib/planner/plan";
import { ActionButton } from "@/components/action-button";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/notice";
import { ConfidenceNote, EvidenceStrip, StatusBadge } from "@/components/ui/status";

export const metadata: Metadata = { title: "Today" };

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ data: docs }, report, { data: plan }] = await Promise.all([
    supabase.from("documents").select("id,status"),
    loadReport(supabase),
    supabase.from("revision_plans").select("id,exam_date,based_on_session_id").eq("status", "active").maybeSingle(),
  ]);
  const ready = (docs ?? []).filter((d) => d.status === "ready").length;

  if (!docs || docs.length === 0) {
    return (
      <EmptyState title="Start by adding your course materials" action={<>
        <ActionButton url="/api/demo/samples" pendingLabel="Loading sample course…">Load the sample PLC course</ActionButton>
        <Link href="/library" className={buttonStyles({ variant: "secondary" })}>Upload my own</Link>
      </>}>
        GapFinder reads your syllabus and notes, then quizzes you on them. The sample course takes about a minute to process.
      </EmptyState>
    );
  }
  if (ready === 0) return <Notice tone="warning" title="Your materials aren't ready yet" action={<Link href="/library" className={buttonStyles({ variant: "secondary" })}>Open materials</Link>}>Uploads are still processing or failed. Check the materials page for details.</Notice>;
  if (report.topics.length === 0) {
    return <EmptyState title="Map the topics in your materials" action={<ActionButton url="/api/topics/build" pendingLabel="Reading your materials…">Build topic map</ActionButton>}>
      GapFinder will list the topics in your syllabus and notes, and link each one to the passages that cover it.
    </EmptyState>;
  }
  if (report.sessions === 0) {
    return <EmptyState title="Find out what you don't know yet" action={<Link href="/quiz" className={buttonStyles()}>Take a diagnostic quiz</Link>}>
      {report.topics.length} topics are mapped. A short quiz written from your own materials will show where the gaps are.
    </EmptyState>;
  }

  const order = prioritize(report.topics, report.topics.map((t) => t.gap));
  const focus = order[0]!;
  const ft = report.topics.find((t) => t.id === focus.topic.id)!;
  const today = new Date().toISOString().slice(0, 10);
  const { data: todaySessions } = plan
    ? await supabase.from("revision_sessions").select("id,minutes,completed_at,topic_id,topics(name)").eq("plan_id", plan.id).eq("scheduled_date", today)
    : { data: null };
  const counts = { weak: 0, developing: 0, strong: 0, insufficient: 0 };
  report.topics.forEach((t) => counts[t.gap.status]++);

  return (
    <div className="space-y-10">
      <section aria-labelledby="focus" className="panel overflow-hidden shadow-lift">
        <div className={`h-1 ${ft.gap.status === "weak" ? "bg-weak" : ft.gap.status === "developing" ? "bg-developing" : "bg-accent"}`} />
        <div className="p-6 sm:p-8">
          <p className="text-sm text-ink-faint">Focus on this next</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 id="focus" className="font-display text-3xl">{ft.name}</h1>
            <StatusBadge status={ft.gap.status} />
          </div>
          <p className="prose-measure mt-3 text-ink-soft">{focus.reason}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <EvidenceStrip verdicts={ft.evidence.map((e) => e.verdict)} label={`${ft.evidence.length} recorded answers for ${ft.name}`} />
            <ConfidenceNote confidence={ft.gap.confidence} answers={ft.gap.counts.answered + ft.gap.counts.unanswered} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/assistant?topic=${ft.id}`} className={buttonStyles()}>Revise it from your notes</Link>
            <Link href={`/quiz?topics=${ft.id}`} className={buttonStyles({ variant: "secondary" })}>Retest this topic</Link>
            <Link href={`/report#t-${ft.id}`} className={buttonStyles({ variant: "ghost" })}>See the evidence</Link>
          </div>
        </div>
      </section>

      {plan && plan.based_on_session_id !== report.latestSessionId && (
        <Notice tone="info" title="Your plan is based on an older quiz" action={<Link href="/plan" className={buttonStyles({ variant: "secondary", size: "sm" })}>Update plan</Link>}>
          You&apos;ve taken a quiz since the plan was made. Update it so it reflects your latest results.
        </Notice>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="today">
          <h2 id="today" className="font-display text-xl">Today&apos;s revision</h2>
          {!plan ? (
            <p className="mt-2 text-sm text-ink-soft">No plan yet. <Link href="/plan" className="text-accent underline-offset-2 hover:underline">Create one</Link> from your exam date and study time.</p>
          ) : !todaySessions?.length ? (
            <p className="mt-2 text-sm text-ink-soft">Nothing scheduled today. <Link href="/plan" className="text-accent underline-offset-2 hover:underline">View the plan</Link>.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
              {todaySessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className={s.completed_at ? "text-ink-faint line-through" : ""}>{(s.topics as unknown as { name: string } | null)?.name}</span>
                  <span className="text-ink-faint">{s.minutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl">Where you stand</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {(["weak", "developing", "strong", "insufficient"] as const).map((s) => (
              <div key={s} className="rounded-lg border border-line bg-surface px-4 py-3">
                <dt><StatusBadge status={s} /></dt>
                <dd className="mt-2 font-display text-2xl">{counts[s]} <span className="font-sans text-sm text-ink-faint">topic{counts[s] === 1 ? "" : "s"}</span></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-faint">From {report.sessions} quiz attempt{report.sessions === 1 ? "" : "s"}. <Link href="/report" className="underline underline-offset-2">How this is calculated</Link></p>
        </section>
      </div>
    </div>
  );
}
