/**
 * Transparent, rule-based gap scoring. The LLM never assigns mastery; it only grades individual answers.
 *
 * 1. Each answer contributes a score: correct 1, partial 0.5, incorrect 0, unanswered 0.
 *    Ambiguous answers are excluded (we don't know), flagged questions are excluded (bad question).
 * 2. Older quiz attempts are down-weighted: weight = 0.6^(attempts ago). Newest attempt = 1.
 * 3. Mastery = (weighted score + 1) / (weighted count + 2)   — a Laplace prior pulls small samples toward 0.5.
 * 4. Status:  effective count < 2           -> insufficient
 *             mastery < 0.50                 -> weak
 *             mastery < 0.75                 -> developing
 *             mastery >= 0.75 and count >= 3 -> strong  (otherwise capped at developing)
 * 5. Confidence: low (<3 answers), medium (3–5), high (6+); downgraded when attempts disagree strongly.
 */
export type GapStatus = "weak" | "developing" | "strong" | "insufficient";
export type Confidence = "low" | "medium" | "high";

export interface AnswerEvidence {
  topic_id: string;
  session_id: string;
  session_index: number; // 0 = newest attempt, 1 = previous, ...
  verdict: "correct" | "partial" | "incorrect" | "unanswered" | "ambiguous";
  flagged?: boolean;
}

export interface TopicGap {
  topic_id: string;
  status: GapStatus;
  mastery: number | null;
  confidence: Confidence;
  counts: { answered: number; correct: number; partial: number; incorrect: number; unanswered: number; excluded: number };
  attempts: number;
  reasons: string[];
}

export const SCORING = { decay: 0.6, minEvidence: 2, strongMinAnswers: 3, weakBelow: 0.5, strongAtOrAbove: 0.75 } as const;
const VALUE = { correct: 1, partial: 0.5, incorrect: 0, unanswered: 0 } as const;

export function scoreTopic(topicId: string, evidence: AnswerEvidence[], prereqStatus: Record<string, GapStatus> = {}, prereqIds: string[] = []): TopicGap {
  const mine = evidence.filter((e) => e.topic_id === topicId);
  const counts = { answered: 0, correct: 0, partial: 0, incorrect: 0, unanswered: 0, excluded: 0 };
  let wSum = 0, wCount = 0;
  const perAttempt = new Map<number, { s: number; n: number }>();

  for (const e of mine) {
    if (e.flagged || e.verdict === "ambiguous") { counts.excluded++; continue; }
    counts[e.verdict]++;
    if (e.verdict !== "unanswered") counts.answered++;
    const w = SCORING.decay ** e.session_index;
    wSum += w * VALUE[e.verdict];
    wCount += w;
    const a = perAttempt.get(e.session_index) ?? { s: 0, n: 0 };
    a.s += VALUE[e.verdict]; a.n++;
    perAttempt.set(e.session_index, a);
  }

  const scored = counts.answered + counts.unanswered;
  const reasons: string[] = [];
  const attempts = perAttempt.size;
  let status: GapStatus;
  let mastery: number | null = null;

  if (wCount < SCORING.minEvidence - 1e-9) {
    status = "insufficient";
    reasons.push(scored === 0 ? "No scored answers yet for this topic." : `Only ${scored} scored answer — not enough to judge.`);
  } else {
    mastery = (wSum + 1) / (wCount + 2);
    if (mastery < SCORING.weakBelow) status = "weak";
    else if (mastery < SCORING.strongAtOrAbove) status = "developing";
    else if (scored >= SCORING.strongMinAnswers) status = "strong";
    else { status = "developing"; reasons.push(`Looks good, but ${SCORING.strongMinAnswers}+ answers are needed to confirm strong.`); }
    reasons.unshift(`${counts.correct} correct, ${counts.partial} partly correct, ${counts.incorrect} incorrect, ${counts.unanswered} blank out of ${scored}.`);
  }
  if (counts.excluded > 0) reasons.push(`${counts.excluded} answer(s) excluded as ambiguous or from flagged questions.`);

  let confidence: Confidence = scored >= 6 ? "high" : scored >= 3 ? "medium" : "low";
  const latest = perAttempt.get(0), earlier = [...perAttempt.entries()].filter(([k]) => k > 0);
  if (latest && latest.n > 0 && earlier.length > 0) {
    const prev = earlier.reduce((acc, [, v]) => ({ s: acc.s + v.s, n: acc.n + v.n }), { s: 0, n: 0 });
    const delta = latest.s / latest.n - prev.s / Math.max(1, prev.n);
    if (Math.abs(delta) >= 0.4) {
      reasons.push(delta > 0 ? "Latest attempt is much better than earlier ones." : "Latest attempt is much worse than earlier ones.");
      if (confidence === "high") confidence = "medium";
    }
  }
  const weakPrereqs = prereqIds.filter((p) => prereqStatus[p] === "weak");
  if (weakPrereqs.length > 0) reasons.push(`Depends on ${weakPrereqs.length} weak prerequisite topic(s).`);

  return { topic_id: topicId, status, mastery, confidence, counts, attempts, reasons };
}

export function scoreAll(topics: { id: string; prerequisite_ids: string[] }[], evidence: AnswerEvidence[]): TopicGap[] {
  // First pass without prerequisite context, then annotate with prerequisite status.
  const first = Object.fromEntries(topics.map((t) => [t.id, scoreTopic(t.id, evidence).status]));
  return topics.map((t) => scoreTopic(t.id, evidence, first, t.prerequisite_ids));
}
