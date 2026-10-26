import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors";
import { scoreAll, type AnswerEvidence, type TopicGap } from "../scoring/gap";
import type { AnswerRow, QuestionRow, QuizSessionRow, TopicRow } from "../types";

export interface EvidenceItem {
  question_id: string; prompt: string; verdict: AnswerRow["verdict"]; method: AnswerRow["method"]; feedback: string;
  submitted_at: string; session_id: string; source: { title: string; page: number | null; section: string | null } | null; quote: string;
}
export interface GapReport {
  topics: (TopicRow & { gap: TopicGap; evidence: EvidenceItem[] })[];
  latestSessionId: string | null;
  sessions: number;
}

export async function loadReport(supabase: SupabaseClient): Promise<GapReport> {
  const [{ data: topics, error: tErr }, { data: sessions }] = await Promise.all([
    supabase.from("topics").select("*").order("position"),
    supabase.from("quiz_sessions").select("id,status,submitted_at,created_at,topic_ids,user_id").eq("status", "submitted").order("submitted_at", { ascending: false }),
  ]);
  if (tErr) throw new AppError("DB_FAILED", "Could not load your topics.");
  const subs = (sessions ?? []) as QuizSessionRow[];
  const sessionIndex = new Map(subs.map((s, i) => [s.id, i]));
  const sessionDate = new Map(subs.map((s) => [s.id, s.submitted_at ?? s.created_at]));

  const ids = subs.map((s) => s.id);
  const [{ data: qs }, { data: ans }] = ids.length
    ? await Promise.all([
        supabase.from("questions").select("id,session_id,topic_id,prompt,evidence_quote,evidence_chunk_id,chunks(page,section,documents(title))").in("session_id", ids),
        supabase.from("answers").select("question_id,verdict,method,feedback,session_id").in("session_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  type QJoin = Pick<QuestionRow, "id" | "session_id" | "topic_id" | "prompt" | "evidence_quote"> & { chunks: { page: number | null; section: string | null; documents: { title: string } | null } | null };
  const qById = new Map(((qs ?? []) as unknown as QJoin[]).map((q) => [q.id, q]));
  const evidence: AnswerEvidence[] = [];
  const items = new Map<string, EvidenceItem[]>();
  for (const a of (ans ?? []) as Pick<AnswerRow, "question_id" | "verdict" | "method" | "feedback" | "session_id">[]) {
    const q = qById.get(a.question_id);
    if (!q) continue;
    evidence.push({ topic_id: q.topic_id, session_id: a.session_id, session_index: sessionIndex.get(a.session_id) ?? 99, verdict: a.verdict });
    const list = items.get(q.topic_id) ?? [];
    list.push({
      question_id: q.id, prompt: q.prompt, verdict: a.verdict, method: a.method, feedback: a.feedback, session_id: a.session_id,
      submitted_at: sessionDate.get(a.session_id) ?? "", quote: q.evidence_quote,
      source: q.chunks ? { title: q.chunks.documents?.title ?? "Document", page: q.chunks.page, section: q.chunks.section } : null,
    });
    items.set(q.topic_id, list);
  }
  const gaps = scoreAll((topics ?? []) as TopicRow[], evidence);
  const gapOf = new Map(gaps.map((g) => [g.topic_id, g]));
  return {
    topics: ((topics ?? []) as TopicRow[]).map((t) => ({ ...t, gap: gapOf.get(t.id)!, evidence: (items.get(t.id) ?? []).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)) })),
    latestSessionId: subs[0]?.id ?? null,
    sessions: subs.length,
  };
}

/** Saves a snapshot of the gap status for each topic in the submitted quiz — this is the progress history. */
export async function recordAssessments(supabase: SupabaseClient, userId: string, sessionId: string) {
  const report = await loadReport(supabase);
  const { data: s } = await supabase.from("quiz_sessions").select("topic_ids").eq("id", sessionId).single();
  const inQuiz = new Set((s?.topic_ids ?? []) as string[]);
  const rows = report.topics.filter((t) => inQuiz.has(t.id)).map((t) => ({
    user_id: userId, topic_id: t.id, session_id: sessionId, status: t.gap.status, mastery: t.gap.mastery,
    answered: t.gap.counts.answered, correct: t.gap.counts.correct, partial: t.gap.counts.partial,
    incorrect: t.gap.counts.incorrect, unanswered: t.gap.counts.unanswered, reasons: t.gap.reasons,
  }));
  if (rows.length) await supabase.from("topic_assessments").upsert(rows, { onConflict: "topic_id,session_id" });
}
