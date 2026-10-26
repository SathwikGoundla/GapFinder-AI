import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReport } from "@/lib/services/report";
import { prioritize } from "@/lib/planner/plan";
import { QuizStarter } from "@/components/quiz-starter";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/notice";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Diagnostic quiz" };

export default async function QuizHome({ searchParams }: { searchParams: Promise<{ topics?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const report = await loadReport(supabase);
  const { data: past } = await supabase.from("quiz_sessions").select("id,status,created_at,topic_ids").order("created_at", { ascending: false }).limit(10);
  if (report.topics.length === 0) {
    return <><PageHeader title="Diagnostic quiz" /><EmptyState title="Map your topics first" action={<Link className={buttonStyles()} href="/topics">Go to topic map</Link>}>Questions are written per topic, so the quiz needs a topic map.</EmptyState></>;
  }
  const requested = (sp.topics ?? "").split(",").filter((id) => report.topics.some((t) => t.id === id));
  const initial = requested.length ? requested : prioritize(report.topics, report.topics.map((t) => t.gap)).slice(0, 4).map((x) => x.topic.id);
  return (
    <>
      <PageHeader title="Diagnostic quiz" description="Questions come from passages in your materials, and each one cites its source. The answers stay hidden until you submit." />
      <QuizStarter topics={report.topics.map((t) => ({ id: t.id, name: t.name, status: t.gap.status }))} initial={initial} />
      {past && past.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl">Earlier quizzes</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {past.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{fmtDate(s.created_at)} · {(s.topic_ids as string[]).length} topics</span>
                <Link href={`/quiz/${s.id}`} className="text-accent underline-offset-2 hover:underline">{s.status === "submitted" ? "View results" : "Continue"}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
