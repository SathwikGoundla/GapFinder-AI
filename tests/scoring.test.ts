import { describe, it, expect } from "vitest";
import { scoreTopic, scoreAll, type AnswerEvidence } from "@/lib/scoring/gap";

const ev = (verdicts: AnswerEvidence["verdict"][], session_index = 0, topic_id = "t"): AnswerEvidence[] =>
  verdicts.map((verdict) => ({ topic_id, session_id: `s${session_index}`, session_index, verdict }));

describe("gap scoring", () => {
  it("marks a topic with one answer as insufficient evidence, not strong", () => {
    const g = scoreTopic("t", ev(["correct"]));
    expect(g.status).toBe("insufficient");
    expect(g.mastery).toBeNull();
  });
  it("marks mostly wrong answers as weak and explains why", () => {
    const g = scoreTopic("t", ev(["incorrect", "incorrect", "partial"]));
    expect(g.status).toBe("weak");
    expect(g.reasons[0]).toMatch(/0 correct, 1 partly correct, 2 incorrect/);
  });
  it("needs at least 3 answers to call a topic strong", () => {
    expect(scoreTopic("t", ev(["correct", "correct"])).status).toBe("developing");
    expect(scoreTopic("t", ev(["correct", "correct", "correct"])).status).toBe("strong");
  });
  it("treats blank answers as not known", () => {
    expect(scoreTopic("t", ev(["unanswered", "unanswered", "correct"])).status).toBe("weak");
  });
  it("excludes ambiguous answers from the score", () => {
    const g = scoreTopic("t", ev(["ambiguous", "ambiguous", "correct"]));
    expect(g.status).toBe("insufficient");
    expect(g.counts.excluded).toBe(2);
  });
  it("weights recent attempts more and flags conflicting evidence", () => {
    const g = scoreTopic("t", [...ev(["correct", "correct", "correct"], 0), ...ev(["incorrect", "incorrect", "incorrect"], 1)]);
    expect(g.mastery!).toBeGreaterThan(0.5);
    expect(g.reasons.join(" ")).toMatch(/much better/);
    expect(g.attempts).toBe(2);
  });
  it("is deterministic", () => {
    const e = ev(["correct", "partial", "incorrect", "correct"]);
    expect(scoreTopic("t", e)).toEqual(scoreTopic("t", e));
  });
  it("notes weak prerequisites", () => {
    const gaps = scoreAll([{ id: "a", prerequisite_ids: [] }, { id: "b", prerequisite_ids: ["a"] }],
      [...ev(["incorrect", "incorrect"], 0, "a"), ...ev(["correct", "partial"], 0, "b")]);
    expect(gaps.find((g) => g.topic_id === "b")!.reasons.join(" ")).toMatch(/weak prerequisite/);
  });
});
