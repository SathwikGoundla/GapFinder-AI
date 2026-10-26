import { describe, it, expect } from "vitest";
import { buildSchedule, daysUntil, prioritize } from "@/lib/planner/plan";
import { scoreTopic, type AnswerEvidence } from "@/lib/scoring/gap";

const ev = (topic_id: string, v: AnswerEvidence["verdict"][]) => v.map((verdict) => ({ topic_id, session_id: "s", session_index: 0, verdict }));
const topics = [
  { id: "timers", name: "Timers", prerequisite_ids: ["ladder"] },
  { id: "ladder", name: "Ladder logic", prerequisite_ids: ["scan"] },
  { id: "scan", name: "Scan cycle", prerequisite_ids: [] },
  { id: "safety", name: "Safety", prerequisite_ids: [] },
];
const evidence = [...ev("timers", ["incorrect", "incorrect", "incorrect"]), ...ev("ladder", ["correct", "partial", "incorrect"]),
  ...ev("scan", ["correct", "correct", "partial"]), ...ev("safety", ["correct", "correct", "correct", "correct"])];
const gaps = topics.map((t) => scoreTopic(t.id, evidence));

describe("revision planner", () => {
  it("puts prerequisites of struggling topics before the topics that depend on them", () => {
    const order = prioritize(topics, gaps).map((o) => o.topic.id);
    expect(order.indexOf("ladder")).toBeLessThan(order.indexOf("timers"));
    expect(order.at(-1)).toBe("safety"); // strong topic last
  });
  it("explains each priority", () => {
    const t = prioritize(topics, gaps).find((o) => o.topic.id === "ladder")!;
    expect(t.reason).toMatch(/prerequisite/);
  });
  it("never exceeds the daily study time and leaves the day before the exam free", () => {
    const s = buildSchedule({ topics, gaps, examDate: "2026-11-10", today: "2026-11-01", dailyMinutes: 60 });
    const perDay = new Map<string, number>();
    s.forEach((x) => perDay.set(x.date, (perDay.get(x.date) ?? 0) + x.minutes));
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(60);
    expect(s.some((x) => x.date === "2026-11-09")).toBe(false);
  });
  it("spaces the second pass on a weak topic by at least two days", () => {
    const s = buildSchedule({ topics, gaps, examDate: "2026-11-10", today: "2026-11-01", dailyMinutes: 120 }).filter((x) => x.topic_id === "timers");
    expect(s).toHaveLength(2);
    const gapDays = (Date.parse(s[1]!.date) - Date.parse(s[0]!.date)) / 86400000;
    expect(gapDays).toBeGreaterThanOrEqual(2);
  });
  it("rejects an exam date that is not in the future", () => {
    expect(() => buildSchedule({ topics, gaps, examDate: "2026-11-01", today: "2026-11-01", dailyMinutes: 60 })).toThrow(/after today/);
    expect(daysUntil("2026-11-03", "2026-11-01")).toEqual(["2026-11-01", "2026-11-02"]);
  });
  it("adapts when results change", () => {
    const improved = topics.map((t) => scoreTopic(t.id, [...evidence.filter((e) => e.topic_id !== "timers"), ...ev("timers", ["correct", "correct", "correct"])]));
    const before = buildSchedule({ topics, gaps, examDate: "2026-11-10", today: "2026-11-01", dailyMinutes: 60 });
    const after = buildSchedule({ topics, gaps: improved, examDate: "2026-11-10", today: "2026-11-01", dailyMinutes: 60 });
    expect(before.filter((x) => x.topic_id === "timers").reduce((n, x) => n + x.minutes, 0))
      .toBeGreaterThan(after.filter((x) => x.topic_id === "timers").reduce((n, x) => n + x.minutes, 0));
  });
});
