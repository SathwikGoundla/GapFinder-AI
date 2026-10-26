import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors";
import { buildSchedule } from "../planner/plan";
import { chatJson } from "../ai/provider";
import { OBJECTIVES_SYSTEM } from "../ai/prompts";
import { sessionObjectivesSchema } from "../ai/schemas";
import { loadReport } from "./report";

export interface Objective { text: string; source: "ai" | "quiz" }

export async function createPlan(supabase: SupabaseClient, userId: string, input: { examDate: string; dailyMinutes: number; today: string }) {
  const report = await loadReport(supabase);
  if (report.topics.length === 0) throw new AppError("NO_EVIDENCE", "Build a topic map before creating a plan.");
  let schedule;
  try {
    schedule = buildSchedule({ topics: report.topics, gaps: report.topics.map((t) => t.gap), examDate: input.examDate, today: input.today, dailyMinutes: input.dailyMinutes });
  } catch (e) {
    throw new AppError("VALIDATION", e instanceof Error ? e.message : "Invalid dates.");
  }
  if (schedule.length === 0) throw new AppError("VALIDATION", "Not enough study time before the exam. Add more minutes per day or pick a later date.");

  // Objectives from recorded mistakes (deterministic), then optionally rewritten by the AI.
  const topicById = new Map(report.topics.map((t) => [t.id, t]));
  const missed = (id: string) => (topicById.get(id)?.evidence ?? []).filter((e) => e.verdict !== "correct").slice(0, 3);
  const quizObjectives = (id: string): Objective[] => {
    const m = missed(id);
    const name = topicById.get(id)?.name ?? "this topic";
    return m.length ? m.map((e) => ({ text: `Revisit: ${e.prompt.slice(0, 140)}`, source: "quiz" as const })) : [{ text: `Read the linked sources on ${name} and take a short check quiz.`, source: "quiz" as const }];
  };
  const uniqueTopics = [...new Set(schedule.map((s) => s.topic_id))];
  let aiObjectives = new Map<string, string[]>();
  try {
    const out = await chatJson({
      system: OBJECTIVES_SYSTEM,
      user: uniqueTopics.map((id) => `topic_id=${id}; topic="${topicById.get(id)?.name}"; status=${topicById.get(id)?.gap.status}; mistakes: ${missed(id).map((e) => `${e.prompt} -> ${e.feedback}`).join(" | ") || "none recorded"}`).join("\n"),
      schema: sessionObjectivesSchema, maxTokens: 1500,
    });
    aiObjectives = new Map(out.sessions.filter((s) => topicById.has(s.topic_id)).map((s) => [s.topic_id, s.objectives]));
  } catch { /* fall back to objectives taken directly from quiz evidence */ }

  const { data: sources } = await supabase.from("topic_sources").select("topic_id,chunk_id").in("topic_id", uniqueTopics);
  const chunkIds = (id: string) => (sources ?? []).filter((s) => s.topic_id === id).slice(0, 3).map((s) => s.chunk_id as string);

  await supabase.from("revision_plans").update({ status: "archived" }).eq("user_id", userId).eq("status", "active");
  const { data: plan, error } = await supabase.from("revision_plans").insert({
    user_id: userId, exam_date: input.examDate, daily_minutes: input.dailyMinutes, based_on_session_id: report.latestSessionId,
  }).select("id").single();
  if (error || !plan) throw new AppError("DB_FAILED", "Could not save the plan.");
  const rows = schedule.map((s) => ({
    plan_id: plan.id, user_id: userId, topic_id: s.topic_id, scheduled_date: s.date, minutes: s.minutes, priority_reason: s.reason,
    chunk_ids: chunkIds(s.topic_id),
    objectives: aiObjectives.get(s.topic_id)?.map((t) => ({ text: t, source: "ai" })) ?? quizObjectives(s.topic_id),
  }));
  const { error: e2 } = await supabase.from("revision_sessions").insert(rows);
  if (e2) throw new AppError("DB_FAILED", "Could not save the plan sessions.");
  return { planId: plan.id as string, sessions: rows.length };
}
