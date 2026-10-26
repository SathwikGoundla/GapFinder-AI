import { describe, it, expect } from "vitest";
import { evaluateMcq, evaluateShort, precheckShort } from "@/lib/eval/evaluate";
import { TEST_ENV, mockFetch, noSleep, chatReply } from "./helpers";

const q = { prompt: "Why is 4-20 mA used?", expected_answer: "0 mA indicates a broken wire while 4 mA is the bottom of the range.", evidence_quote: "a reading of 0 mA clearly indicates a broken wire" };

describe("answer evaluation", () => {
  it("grades MCQs objectively", () => {
    const m = { options: ["a", "b", "c", "d"], correct_option: 2, expected_answer: "c is right" };
    expect(evaluateMcq(m, 2)).toMatchObject({ verdict: "correct", score: 1, method: "objective" });
    expect(evaluateMcq(m, 0)).toMatchObject({ verdict: "incorrect", score: 0, missing_points: ["c"] });
    expect(evaluateMcq(m, null)).toMatchObject({ verdict: "unanswered", method: "none" });
  });
  it("handles blank and exact-match short answers without calling the AI", () => {
    expect(precheckShort("  ", q.expected_answer)?.verdict).toBe("unanswered");
    expect(precheckShort("0 mA indicates a BROKEN wire, while 4 mA is the bottom of the range", q.expected_answer)?.method).toBe("objective");
    expect(precheckShort("something else", q.expected_answer)).toBeNull();
  });
  it("accepts a differently worded but equivalent answer when the AI judges it correct", async () => {
    const f = mockFetch([chatReply(JSON.stringify({ verdict: "correct", correct_points: ["wire break detection", "live zero"], missing_points: [], feedback: "Right: a live zero lets you detect a cut cable." }))]);
    const r = await evaluateShort(q, "Because a cut cable shows up as zero current, which is below the 4 mA live zero.", { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep });
    expect(r).toMatchObject({ verdict: "correct", score: 1, method: "ai_semantic" });
    expect(JSON.stringify(f.calls[0]!.body)).toContain("Judge meaning, not wording");
  });
  it("keeps ambiguous answers separate (score 0, excluded later by scoring)", async () => {
    const f = mockFetch([chatReply(JSON.stringify({ verdict: "ambiguous", feedback: "Unclear whether you meant the signal or the supply." }))]);
    const r = await evaluateShort(q, "it's safer", { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep });
    expect(r.verdict).toBe("ambiguous");
  });
});
