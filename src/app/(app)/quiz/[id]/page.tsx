import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizRunner, type ClientQuestion } from "@/components/quiz-runner";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/notice";
import { formatSource } from "@/lib/types";

export const metadata: Metadata = { title: "Quiz" };
const VERDICT = {
  correct: ["Correct", "text-strong", "border-strong"], partial: ["Partly correct", "text-developing", "border-developing"],
  incorrect: ["Incorrect", "text-weak", "border-weak"], unanswered: ["Not answered", "text-weak", "border-weak"],
  ambiguous: ["Not counted (needs review)", "text-unknown", "border-unknown"],
} as const;
const METHOD = { objective: "Checked by exact match", ai_semantic: "Graded by AI for meaning", none: "Not graded" } as const;

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase.from("quiz_sessions").select("id,status").eq("id", id).maybeSingle();
  if (!session) notFound();
  const { data: topics } = await supabase.from("topics").select("id,name");
  const topicName = new Map((topics ?? []).map((t) => [t.id as string, t.name as string]));

  if (session.status === "in_progress") {
    // Only safe columns: the expected answer, correct option and evidence are NOT sent before submission.
    const { data } = await supabase.from("questions").select("id,type,prompt,options,difficulty,topic_id").eq("session_id", id).order("position");
    const qs: ClientQuestion[] = (data ?? []).map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, difficulty: q.difficulty, topic: topicName.get(q.topic_id) ?? "Topic" }));
    if (qs.length === 0) return <><PageHeader title="Diagnostic quiz" /><EmptyState title="This quiz has no questions" action={<Link href="/quiz" className={buttonStyles()}>Start a new quiz</Link>}>Question generation was interrupted. Nothing was scored.</EmptyState></>;
    return <><PageHeader title="Diagnostic quiz" description="Answer honestly — guessing hides the gaps this quiz is trying to find. Leave it blank if you don't know." /><QuizRunner sessionId={id} questions={qs} /></>;
  }

  const { data: rows } = await supabase.from("questions")
    .select("id,type,prompt,options,correct_option,expected_answer,evidence_quote,topic_id,chunks(page,section,documents(title)),answers(verdict,method,feedback,response,selected_option,missing_points)")
    .eq("session_id", id).order("position");
  type R = { id: string; type: "mcq" | "short"; prompt: string; options: string[] | null; correct_option: number | null; expected_answer: string; evidence_quote: string; topic_id: string;
    chunks: { page: number | null; section: string | null; documents: { title: string } | null } | null;
    answers: { verdict: keyof typeof VERDICT; method: keyof typeof METHOD; feedback: string; response: string | null; selected_option: number | null; missing_points: string[] }[] | { verdict: keyof typeof VERDICT; method: keyof typeof METHOD; feedback: string; response: string | null; selected_option: number | null; missing_points: string[] } | null };
  const results = (rows ?? []) as unknown as R[];
  const ans = (r: R) => (Array.isArray(r.answers) ? r.answers[0] : r.answers) ?? null;
  const scored = results.filter((r) => ans(r) && ans(r)!.verdict !== "ambiguous");
  const correct = scored.filter((r) => ans(r)!.verdict === "correct").length;
  const partial = scored.filter((r) => ans(r)!.verdict === "partial").length;

  return (
    <>
      <PageHeader title="Quiz results" description={`${correct} correct and ${partial} partly correct out of ${scored.length} scored questions. Each answer below shows how it was checked and where the answer comes from.`}
        actions={<Link href="/report" className={buttonStyles()}>See gap report</Link>} />
      <ol className="space-y-4">
        {results.map((r, n) => {
          const a = ans(r);
          const v = VERDICT[a?.verdict ?? "unanswered"];
          return (
            <li key={r.id} className={`panel border-l-4 p-5 ${v[2]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink-faint">Q{n + 1} · {topicName.get(r.topic_id)}</span>
                <span className={`font-medium ${v[1]}`}>{v[0]}</span>
              </div>
              <p className="mt-2 font-medium">{r.prompt}</p>
              <dl className="mt-3 grid gap-2 text-sm">
                <div><dt className="inline text-ink-faint">Your answer: </dt><dd className="inline">{r.type === "mcq" ? (a?.selected_option != null ? r.options?.[a.selected_option] : "—") : (a?.response || "—")}</dd></div>
                <div><dt className="inline text-ink-faint">Reference answer: </dt><dd className="inline">{r.type === "mcq" && r.correct_option != null ? `${r.options?.[r.correct_option]}. ` : ""}{r.expected_answer}</dd></div>
                {a && <div><dt className="inline text-ink-faint">Feedback: </dt><dd className="inline">{a.feedback}</dd></div>}
                {a && a.missing_points.length > 0 && <div><dt className="text-ink-faint">Missing:</dt><dd><ul className="list-disc pl-5">{a.missing_points.map((m, k) => <li key={k}>{m}</li>)}</ul></dd></div>}
              </dl>
              <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm text-ink-soft">
                &ldquo;{r.evidence_quote}&rdquo;
                <footer className="mt-1 text-xs text-ink-faint">Source: {formatSource({ title: r.chunks?.documents?.title ?? "Document", page: r.chunks?.page ?? null, section: r.chunks?.section ?? null })} · {a ? METHOD[a.method] : "Not graded"}</footer>
              </blockquote>
            </li>
          );
        })}
      </ol>
    </>
  );
}
