import { chatJson, type ProviderDeps } from "../ai/provider";
import { EVALUATE_SYSTEM } from "../ai/prompts";
import { shortAnswerEvalSchema } from "../ai/schemas";
import { normalizeForMatch } from "../rag/citations";

export type Verdict = "correct" | "partial" | "incorrect" | "unanswered" | "ambiguous";
export interface Evaluation {
  verdict: Verdict;
  score: number; // 0..1 ; ambiguous answers are excluded from mastery, not scored as 0
  method: "objective" | "ai_semantic" | "none";
  feedback: string;
  missing_points: string[];
}

export const VERDICT_SCORE: Record<Verdict, number> = { correct: 1, partial: 0.5, incorrect: 0, unanswered: 0, ambiguous: 0 };

export function evaluateMcq(q: { options: string[]; correct_option: number; expected_answer: string }, selected: number | null): Evaluation {
  if (selected === null || selected === undefined) {
    return { verdict: "unanswered", score: 0, method: "none", feedback: "No option was selected.", missing_points: [] };
  }
  const ok = selected === q.correct_option;
  const right = q.options[q.correct_option] ?? "";
  return {
    verdict: ok ? "correct" : "incorrect",
    score: ok ? 1 : 0,
    method: "objective",
    feedback: ok ? `Correct. ${q.expected_answer}` : `The correct option is "${right}". ${q.expected_answer}`,
    missing_points: ok ? [] : [right],
  };
}

/** Deterministic pre-checks that need no AI: empty answers and exact matches. */
export function precheckShort(response: string | null, expected: string): Evaluation | null {
  const r = (response ?? "").trim();
  if (r.length === 0) return { verdict: "unanswered", score: 0, method: "none", feedback: "This question was left blank.", missing_points: [] };
  const bare = (x: string) => normalizeForMatch(x).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  if (bare(r) === bare(expected)) {
    return { verdict: "correct", score: 1, method: "objective", feedback: "Your answer matches the reference answer.", missing_points: [] };
  }
  return null;
}

export async function evaluateShort(
  q: { prompt: string; expected_answer: string; evidence_quote: string },
  response: string | null,
  deps: ProviderDeps = {},
): Promise<Evaluation> {
  const pre = precheckShort(response, q.expected_answer);
  if (pre) return pre;
  const r = await chatJson({
    system: EVALUATE_SYSTEM,
    user: `Question: ${q.prompt}\nReference answer: ${q.expected_answer}\nSource evidence: "${q.evidence_quote}"\nStudent answer: ${(response ?? "").slice(0, 2000)}`,
    schema: shortAnswerEvalSchema,
    maxTokens: 600,
  }, deps);
  return {
    verdict: r.verdict,
    score: VERDICT_SCORE[r.verdict],
    method: "ai_semantic",
    feedback: r.feedback,
    missing_points: r.missing_points,
  };
}
