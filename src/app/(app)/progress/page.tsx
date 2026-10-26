import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status";
import type { GapStatus } from "@/lib/scoring/gap";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };
type A = { topic_id: string; session_id: string; status: GapStatus; correct: number; partial: number; incorrect: number; unanswered: number; computed_at: string };

export default async function Progress() {
  const supabase = await createClient();
  const [{ data: sessions }, { data: assess }, { data: topics }, { count: doneSessions }] = await Promise.all([
    supabase.from("quiz_sessions").select("id,submitted_at,topic_ids").eq("status", "submitted").order("submitted_at"),
    supabase.from("topic_assessments").select("topic_id,session_id,status,correct,partial,incorrect,unanswered,computed_at").order("computed_at"),
    supabase.from("topics").select("id,name").order("position"),
    supabase.from("revision_sessions").select("id", { count: "exact", head: true }).not("completed_at", "is", null),
  ]);
  const subs = sessions ?? [];
  if (subs.length === 0) return <><PageHeader title="Progress" /><EmptyState title="No attempts yet" action={<Link href="/quiz" className={buttonStyles()}>Take a quiz</Link>}>Progress appears after your first submitted quiz. Nothing here is estimated or pre-filled.</EmptyState></>;

  const rows = (assess ?? []) as A[];
  const sessionNo = new Map(subs.map((s, i) => [s.id, i + 1]));
  const perSession = subs.map((s) => {
    const r = rows.filter((a) => a.session_id === s.id);
    // Accuracy for THIS attempt only is not stored per snapshot, so show topic outcomes instead of a misleading single %.
    return { id: s.id, date: s.submitted_at as string, topics: r.length, weak: r.filter((a) => a.status === "weak").length, strong: r.filter((a) => a.status === "strong").length };
  });
  const history = (topics ?? []).map((t) => ({ ...t, snaps: rows.filter((a) => a.topic_id === t.id) })).filter((t) => t.snaps.length > 0);

  return (
    <>
      <PageHeader title="Progress" description={`${subs.length} quiz attempt${subs.length === 1 ? "" : "s"} and ${doneSessions ?? 0} completed revision session${doneSessions === 1 ? "" : "s"}.`} />
      <section aria-labelledby="topic-h">
        <h2 id="topic-h" className="font-display text-xl">How each topic has changed</h2>
        <p className="mt-1 text-sm text-ink-soft">Each badge is the topic&apos;s rating right after that attempt. A change is only shown when the topic was tested in more than one attempt.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-ink-faint"><tr><th scope="col" className="px-4 py-2 font-medium">Topic</th><th scope="col" className="px-4 py-2 font-medium">Ratings over attempts</th><th scope="col" className="px-4 py-2 font-medium">Change</th></tr></thead>
            <tbody className="divide-y divide-line">
              {history.map((t) => {
                const first = t.snaps[0]!, last = t.snaps[t.snaps.length - 1]!;
                const rank = { insufficient: -1, weak: 0, developing: 1, strong: 2 };
                const comparable = t.snaps.length > 1 && first.status !== "insufficient" && last.status !== "insufficient";
                const change = !comparable ? "Not enough data" : rank[last.status] > rank[first.status] ? "Improved" : rank[last.status] < rank[first.status] ? "Dropped" : "No change";
                return (
                  <tr key={t.id}>
                    <th scope="row" className="px-4 py-3 font-medium">{t.name}</th>
                    <td className="px-4 py-3"><span className="flex flex-wrap items-center gap-1.5">{t.snaps.map((s, i) => <span key={i} className="flex items-center gap-1"><span className="text-xs text-ink-faint">#{sessionNo.get(s.session_id)}</span><StatusBadge status={s.status} /></span>)}</span></td>
                    <td className={`px-4 py-3 ${change === "Improved" ? "text-strong" : change === "Dropped" ? "text-weak" : "text-ink-faint"}`}>{change}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="att-h" className="mt-10">
        <h2 id="att-h" className="font-display text-xl">Attempts</h2>
        <ol className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {perSession.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>#{i + 1} · {fmtDate(s.date)} · {s.topics} topic{s.topics === 1 ? "" : "s"} tested · {s.weak} weak, {s.strong} strong after this attempt</span>
              <Link href={`/quiz/${s.id}`} className="text-accent underline-offset-2 hover:underline">Answers</Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
