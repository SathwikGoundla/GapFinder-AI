import type { TopicGap, GapStatus } from "../scoring/gap";

/**
 * Deterministic revision scheduler. The LLM only writes session objectives afterwards.
 * Priority = base(status) + 1 if it is a prerequisite of a weak/developing topic + (1 - mastery).
 */
export interface PlanTopic { id: string; name: string; prerequisite_ids: string[] }
export interface PlannedSession { topic_id: string; date: string; minutes: number; reason: string; kind: "learn" | "reinforce" | "check" | "review" }

const BASE: Record<GapStatus, number> = { weak: 3, developing: 2, insufficient: 1.5, strong: 0.5 };
const SESSION_MIN = 20, SESSION_MAX = 50;

export function daysUntil(examDate: string, today: string): string[] {
  const days: string[] = [];
  const start = new Date(today + "T00:00:00Z");
  const end = new Date(examDate + "T00:00:00Z");
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  return days;
}

export function prioritize(topics: PlanTopic[], gaps: TopicGap[]) {
  const gapOf = new Map(gaps.map((g) => [g.topic_id, g]));
  const needy = new Set(gaps.filter((g) => g.status === "weak" || g.status === "developing").map((g) => g.topic_id));
  const prereqOfNeedy = new Set(topics.filter((t) => needy.has(t.id)).flatMap((t) => t.prerequisite_ids));
  const items = topics.map((t) => {
    const g = gapOf.get(t.id);
    const status: GapStatus = g?.status ?? "insufficient";
    const isPrereq = prereqOfNeedy.has(t.id) && status !== "strong";
    const priority = BASE[status] + (isPrereq ? 1 : 0) + (g?.mastery != null ? 1 - g.mastery : 0.5);
    const reason =
      status === "weak" ? `Weak: ${g?.reasons[0] ?? "low quiz performance."}` :
      status === "developing" ? `Developing: ${g?.reasons[0] ?? "partly understood."}` :
      status === "insufficient" ? "Not enough quiz evidence yet — a short check will show where you stand." :
      "Strong — a light review keeps it fresh.";
    return { topic: t, status, priority, reason: isPrereq ? `${reason} It is also a prerequisite for a topic you are struggling with.` : reason };
  });
  items.sort((a, b) => b.priority - a.priority);
  // Make sure prerequisites come before the topics that depend on them.
  const ordered: typeof items = [];
  const placed = new Set<string>();
  const place = (it: (typeof items)[number], depth = 0) => {
    if (placed.has(it.topic.id) || depth > 10) return;
    for (const p of it.topic.prerequisite_ids) { const pre = items.find((x) => x.topic.id === p); if (pre && pre.status !== "strong") place(pre, depth + 1); }
    placed.add(it.topic.id); ordered.push(it);
  };
  items.forEach((it) => place(it));
  return ordered;
}

export function buildSchedule(input: { topics: PlanTopic[]; gaps: TopicGap[]; examDate: string; today: string; dailyMinutes: number }): PlannedSession[] {
  const days = daysUntil(input.examDate, input.today);
  if (days.length === 0) throw new Error("The exam date must be after today.");
  const studyDays = days.length > 1 ? days.slice(0, -1) : days; // keep the last day before the exam for a light review
  const ordered = prioritize(input.topics, input.gaps);

  // Desired sessions per topic; weak topics get a spaced second pass.
  const want: { id: string; kind: PlannedSession["kind"]; minutes: number; reason: string; gapAfter: number }[] = [];
  for (const it of ordered) {
    if (it.status === "weak") { want.push({ id: it.topic.id, kind: "learn", minutes: 45, reason: it.reason, gapAfter: 0 }); }
    else if (it.status === "developing") want.push({ id: it.topic.id, kind: "reinforce", minutes: 35, reason: it.reason, gapAfter: 0 });
    else if (it.status === "insufficient") want.push({ id: it.topic.id, kind: "check", minutes: 20, reason: it.reason, gapAfter: 0 });
  }
  for (const it of ordered) if (it.status === "weak") want.push({ id: it.topic.id, kind: "reinforce", minutes: 30, reason: "Second pass, spaced at least two days after the first, to make it stick.", gapAfter: 2 });
  for (const it of ordered) if (it.status === "strong") want.push({ id: it.topic.id, kind: "review", minutes: SESSION_MIN, reason: it.reason, gapAfter: 0 });

  const used = new Map<string, number>();
  const firstDayOf = new Map<string, number>();
  const out: PlannedSession[] = [];
  for (const w of want) {
    const minutes = Math.max(SESSION_MIN, Math.min(SESSION_MAX, Math.min(w.minutes, input.dailyMinutes)));
    const earliest = w.gapAfter > 0 ? (firstDayOf.get(w.id) ?? -1) + w.gapAfter : 0;
    for (let i = Math.max(0, earliest); i < studyDays.length; i++) {
      const day = studyDays[i]!;
      if ((used.get(day) ?? 0) + minutes <= input.dailyMinutes) {
        used.set(day, (used.get(day) ?? 0) + minutes);
        if (!firstDayOf.has(w.id)) firstDayOf.set(w.id, i);
        out.push({ topic_id: w.id, date: day, minutes, reason: w.reason, kind: w.kind });
        break;
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
