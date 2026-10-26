import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors";
import { chatJson } from "../ai/provider";
import { QUESTION_SYSTEM, formatEvidence } from "../ai/prompts";
import { generatedQuestionSchema, questionBatchSchema, type GeneratedQuestion } from "../ai/schemas";
import { validateCitation, type RetrievedChunk } from "../rag/citations";
import { retrieve } from "../rag/retrieve";
import { evaluateMcq, evaluateShort, type Evaluation } from "../eval/evaluate";
import { recordAssessments } from "./report";
import type { QuestionRow, TopicRow } from "../types";

/** Keeps only questions whose structure is valid AND whose citation points at real retrieved text. */
export function acceptQuestions(raw: unknown[], retrieved: RetrievedChunk[]) {
  const accepted: GeneratedQuestion[] = [];
  let rejected = 0;
  for (const item of raw) {
    const q = generatedQuestionSchema.safeParse(item);
    if (!q.success) { rejected++; continue; }
    const cite = validateCitation(q.data.evidence_chunk_id, q.data.evidence_quote, retrieved);
    if (!cite.ok) { rejected++; continue; }
    accepted.push(q.data);
  }
  return { accepted, rejected };
}

async function evidenceForTopic(supabase: SupabaseClient, topic: TopicRow): Promise<RetrievedChunk[]> {
  const { data: linked } = await supabase.from("topic_sources").select("chunks(id,document_id,content,page,section)").eq("topic_id", topic.id).limit(4);
  const fromMap = ((linked ?? []) as unknown as { chunks: Omit<RetrievedChunk, "similarity"> | null }[])
    .map((r) => r.chunks).filter((c): c is Omit<RetrievedChunk, "similarity"> => Boolean(c)).map((c) => ({ ...c, similarity: 1 }));
  const searched = await retrieve(supabase, `${topic.name}. ${topic.description ?? ""}`, { topK: 4 });
  const all = [...fromMap, ...searched];
  return all.filter((c, i) => all.findIndex((x) => x.id === c.id) === i).slice(0, 5);
}

export async function createQuiz(supabase: SupabaseClient, userId: string, input: { topicIds: string[]; questionsPerTopic: number; idempotencyKey: string }) {
  const { data: session, error } = await supabase.from("quiz_sessions")
    .insert({ user_id: userId, topic_ids: input.topicIds, idempotency_key: input.idempotencyKey }).select("id").single();
  if (error?.code === "23505") {
    const { data: prev } = await supabase.from("quiz_sessions").select("id").eq("idempotency_key", input.idempotencyKey).single();
    if (prev) return { sessionId: prev.id, reused: true, generated: 0, rejected: 0, skippedTopics: [] as string[] };
  }
  if (error || !session) throw new AppError("DB_FAILED", "Could not start the quiz.");

  try {
    const { data: topics } = await supabase.from("topics").select("*").in("id", input.topicIds);
    if (!topics || topics.length !== input.topicIds.length) throw new AppError("NOT_FOUND", "One or more topics were not found.");
    const rows: Omit<QuestionRow, "id">[] = [];
    let rejected = 0;
    const skippedTopics: string[] = [];
    for (const topic of topics as TopicRow[]) { // sequential: friendlier to free-tier rate limits
      const evidence = await evidenceForTopic(supabase, topic);
      if (evidence.length === 0) { skippedTopics.push(topic.name); continue; }
      const { data: docs } = await supabase.from("documents").select("id,title").in("id", [...new Set(evidence.map((e) => e.document_id))]);
      const title = new Map((docs ?? []).map((d) => [d.id, d.title as string]));
      let rawQuestions: unknown[] = [];
      try {
        const out = await chatJson({
          system: QUESTION_SYSTEM,
          user: `Topic: ${topic.name}\nWrite ${input.questionsPerTopic} questions (mix multiple-choice and short-answer).\n\n${formatEvidence(evidence.map((e) => ({ id: e.id, label: `${title.get(e.document_id) ?? "Document"}${e.page ? ` p.${e.page}` : ""}`, content: e.content })))}`,
          schema: questionBatchSchema, maxTokens: 2500,
        });
        rawQuestions = out.questions.slice(0, input.questionsPerTopic);
      } catch (err: unknown) {
        if (err instanceof AppError && (err.code === "AI_RATE_LIMITED" || err.code === "AI_FAILED" || err.code === "AI_TIMEOUT" || err.code === "AI_BAD_OUTPUT")) {
          console.warn("AI question generation hit an issue; using evidence-derived questions for topic:", topic.name);
          rawQuestions = evidence.slice(0, input.questionsPerTopic).map((e) => {
            const sentence = e.content.split(/[.?!]\s+/).find((s) => s.length > 20 && s.length < 250) || e.content.slice(0, 150);
            return {
              type: "short",
              difficulty: "medium",
              prompt: `Based on your course materials, explain the key principles of: ${topic.name}`,
              options: null,
              correct_option: null,
              expected_answer: sentence.trim(),
              evidence_chunk_id: e.id,
              evidence_quote: sentence.trim(),
            };
          });
        } else {
          throw err;
        }
      }
      const { accepted, rejected: r } = acceptQuestions(rawQuestions, evidence);
      rejected += r;
      if (accepted.length === 0) skippedTopics.push(topic.name);
      for (const q of accepted) rows.push({
        session_id: session.id, user_id: userId, topic_id: topic.id, position: rows.length, type: q.type, difficulty: q.difficulty,
        prompt: q.prompt, options: q.type === "mcq" ? q.options : null, correct_option: q.type === "mcq" ? q.correct_option : null,
        expected_answer: q.expected_answer, evidence_chunk_id: q.evidence_chunk_id, evidence_quote: q.evidence_quote,
      });
    }
    if (rows.length === 0) throw new AppError("NO_EVIDENCE", "Your materials did not contain enough clear evidence to write questions for these topics.");
    const { error: qErr } = await supabase.from("questions").insert(rows);
    if (qErr) throw new AppError("DB_FAILED", "Could not save the questions.");
    return { sessionId: session.id as string, reused: false, generated: rows.length, rejected, skippedTopics };
  } catch (err) {
    await supabase.from("quiz_sessions").delete().eq("id", session.id);
    throw err;
  }
}

export async function submitQuiz(supabase: SupabaseClient, userId: string, sessionId: string, answers: { questionId: string; selectedOption: number | null; response: string | null }[]) {
  const { data: s } = await supabase.from("quiz_sessions").select("id,user_id,status").eq("id", sessionId).maybeSingle();
  if (!s || s.user_id !== userId) throw new AppError("NOT_FOUND", "That quiz was not found.");
  // Atomic claim: only one submission can move the session out of in_progress.
  const { data: claimed } = await supabase.from("quiz_sessions").update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", sessionId).eq("status", "in_progress").select("id");
  if (!claimed || claimed.length === 0) return { sessionId, alreadySubmitted: true };

  const { data: qs } = await supabase.from("questions").select("*").eq("session_id", sessionId).order("position");
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const rows = [];
  for (const q of (qs ?? []) as QuestionRow[]) {
    const a = byId.get(q.id);
    let ev: Evaluation;
    if (q.type === "mcq") ev = evaluateMcq({ options: q.options ?? [], correct_option: q.correct_option ?? -1, expected_answer: q.expected_answer }, a?.selectedOption ?? null);
    else {
      try { ev = await evaluateShort(q, a?.response ?? null); }
      catch { ev = { verdict: "ambiguous", score: 0, method: "none", feedback: "This answer could not be graded automatically, so it is not counted in your gap report.", missing_points: [] }; }
    }
    rows.push({ question_id: q.id, session_id: sessionId, user_id: userId, response: a?.response ?? null, selected_option: a?.selectedOption ?? null, ...ev });
  }
  const { error } = await supabase.from("answers").upsert(rows, { onConflict: "question_id", ignoreDuplicates: true });
  if (error) {
    await supabase.from("quiz_sessions").update({ status: "in_progress", submitted_at: null }).eq("id", sessionId);
    throw new AppError("DB_FAILED", "Could not save your answers. Your quiz is still open — submit again.");
  }
  await recordAssessments(supabase, userId, sessionId);
  return { sessionId, alreadySubmitted: false };
}
