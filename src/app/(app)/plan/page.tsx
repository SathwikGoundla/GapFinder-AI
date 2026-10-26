import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReport } from "@/lib/services/report";
import { PlanForm, SessionToggle } from "@/components/plan-form";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status";
import { formatSource } from "@/lib/types";

export const metadata: Metadata = { title: "Revision plan" };
type S = { id: string; topic_id: string; scheduled_date: string; minutes: number; priority_reason: string; completed_at: string | null; objectives: { text: string; source: "ai" | "quiz" }[]; chunk_ids: string[] };

export default async function Plan() {
  const supabase = await createClient();
  const report = await loadReport(supabase);
  const { data: plan } = await supabase.from("revision_plans").select("*").eq("status", "active").maybeSingle();
  if (report.topics.length === 0) return <><PageHeader title="Revision plan" /><EmptyState title="Map your topics first" action={<Link href="/topics" className={buttonStyles()}>Go to topic map</Link>} /></>;
  if (!plan) {
    return (
      <>
        <PageHeader title="Revision plan" description="Tell GapFinder when your exam is and how long you can study each day. Weak topics and the topics they depend on are scheduled first." />
        {report.sessions === 0 && <Notice tone="warning" title="You haven't taken a quiz yet" className="mb-6">Without quiz results every topic counts as &ldquo;not enough evidence&rdquo;, so the plan will mostly schedule short check-ins. <Link href="/quiz" className="underline">Take a quiz first</Link> for a sharper plan.</Notice>}
        <PlanForm label="Create plan" />
      </>
    );
  }
  const { data } = await supabase.from("revision_sessions").select("*").eq("plan_id", plan.id).order("scheduled_date");
  const sessions = (data ?? []) as S[];
  const chunkIds = [...new Set(sessions.flatMap((s) => s.chunk_ids))];
  const { data: chunks } = chunkIds.length ? await supabase.from("chunks").select("id,page,section,documents(title)").in("id", chunkIds) : { data: [] };
  const src = new Map(((chunks ?? []) as unknown as { id: string; page: number | null; section: string | null; documents: { title: string } | null }[]).map((c) => [c.id, formatSource({ title: c.documents?.title ?? "Document", page: c.page, section: c.section })]));
  const topic = new Map(report.topics.map((t) => [t.id, t]));
  const byDay = sessions.reduce((m, s) => m.set(s.scheduled_date, [...(m.get(s.scheduled_date) ?? []), s]), new Map<string, S[]>());
  const done = sessions.filter((s) => s.completed_at).length;
  const today = new Date().toISOString().slice(0, 10);
  const stale = plan.based_on_session_id !== report.latestSessionId;

  return (
    <>
      <PageHeader title="Revision plan" description={`${done} of ${sessions.length} sessions done. Exam on ${new Date(plan.exam_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}. The day before is left free for a light review.`} />
      {stale && <Notice tone="info" title="You've taken a quiz since this plan was made" className="mb-6">Update the plan below so it uses your latest results. Completed sessions stay in your history.</Notice>}
      <div className="mb-8"><PlanForm examDate={plan.exam_date} dailyMinutes={plan.daily_minutes} label={stale ? "Update plan with latest results" : "Rebuild plan"} /></div>
      <ol className="space-y-8">
        {[...byDay.entries()].map(([day, list]) => (
          <li key={day}>
            <h2 className={`font-display text-lg ${day === today ? "text-accent" : ""}`}>
              {new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}{day === today && " · Today"}
              <span className="ml-2 font-sans text-sm text-ink-faint">{(list as S[]).reduce((n, s) => n + s.minutes, 0)} min</span>
            </h2>
            <ul className="mt-3 space-y-3">
              {(list as S[]).map((s) => {
                const t = topic.get(s.topic_id);
                return (
                  <li key={s.id} className={`panel p-5 ${s.completed_at ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t?.name ?? "Topic"}</span>{t && <StatusBadge status={t.gap.status} />}<span className="text-sm text-ink-faint">{s.minutes} min</span></div>
                      <SessionToggle id={s.id} completed={Boolean(s.completed_at)} />
                    </div>
                    <p className="mt-2 text-sm text-ink-soft"><span className="text-ink-faint">Why: </span>{s.priority_reason}</p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">{s.objectives.map((o, i) => <li key={i}>{o.text}</li>)}</ul>
                    <p className="mt-1 text-xs text-ink-faint">{s.objectives[0]?.source === "ai" ? "Objectives drafted by AI from your quiz mistakes." : "Objectives taken directly from your quiz results."}</p>
                    {s.chunk_ids.length > 0 && <p className="mt-2 text-xs text-ink-faint">Read: {s.chunk_ids.map((c) => src.get(c)).filter(Boolean).join(" · ")}</p>}
                    <div className="mt-3 flex gap-2">
                      <Link href={`/assistant?topic=${s.topic_id}`} className={buttonStyles({ size: "sm", variant: "ghost" })}>Explain from my notes</Link>
                      <Link href={`/quiz?topics=${s.topic_id}`} className={buttonStyles({ size: "sm", variant: "ghost" })}>Check with a quiz</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
