import { describe, it, expect } from "vitest";
import { z } from "zod";
import { chatJson, embed, parseJsonObject } from "@/lib/ai/provider";
import { getAiEnv } from "@/lib/env";
import { generatedQuestionSchema } from "@/lib/ai/schemas";
import { acceptQuestions } from "@/lib/services/quiz";
import { keepVerifiedClaims } from "@/lib/services/assistant";
import { TEST_ENV, mockFetch, noSleep, chatReply } from "./helpers";
import type { RetrievedChunk } from "@/lib/rag/citations";

const schema = z.object({ answer: z.string() });

describe("AI provider", () => {
  it("fails clearly when the provider is not configured", () => {
    expect(() => getAiEnv({})).toThrow(/not configured/);
  });
  it("parses valid JSON and JSON wrapped in markdown fences", async () => {
    const f = mockFetch([chatReply('```json\n{"answer":"ok"}\n```')]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).resolves.toEqual({ answer: "ok" });
  });
  it("rejects output that doesn't match the schema", async () => {
    const f = mockFetch([chatReply('{"wrong":1}')]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("rejects truncated output", async () => {
    const f = mockFetch([chatReply('{"answer":"cut', "length")]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(() => parseJsonObject('{"answer": "unterminated')).toThrow(/unreadable|incomplete/);
  });
  it("retries rate limits a bounded number of times, then succeeds", async () => {
    const f = mockFetch([{ status: 429 }, { status: 503 }, chatReply('{"answer":"ok"}')]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).resolves.toEqual({ answer: "ok" });
    expect(f.calls).toHaveLength(3);
  });
  it("stops after the retry limit and reports rate limiting", async () => {
    const f = mockFetch([{ status: 429 }, { status: 429 }, { status: 429 }, chatReply('{"answer":"never"}')]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).rejects.toMatchObject({ code: "AI_RATE_LIMITED" });
    expect(f.calls).toHaveLength(3);
  });
  it("does not retry a timed-out request (keeps worst case under the 60 s function limit)", async () => {
    let calls = 0;
    const hang = (async () => { calls++; const e = new Error("aborted"); e.name = "AbortError"; throw e; }) as unknown as typeof fetch;
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: hang, sleep: noSleep })).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(calls).toBe(1);
  });
  it("does not retry an invalid API key", async () => {
    const f = mockFetch([{ status: 401 }, chatReply('{"answer":"x"}')]);
    await expect(chatJson({ system: "s", user: "u", schema }, { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(f.calls).toHaveLength(1);
  });
  it("embeds in batches and checks vector dimensions", async () => {
    const f = mockFetch([{ status: 200, body: { data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5, 6] }] } }]);
    await expect(embed(["a", "b"], { env: TEST_ENV, fetchImpl: f.impl, sleep: noSleep })).resolves.toEqual([[1, 2, 3], [4, 5, 6]]);
    const bad = mockFetch([{ status: 200, body: { data: [{ embedding: [1, 2] }] } }]);
    await expect(embed(["a"], { env: TEST_ENV, fetchImpl: bad.impl, sleep: noSleep })).rejects.toThrow(/does not match/);
  });
});

describe("question validation", () => {
  const ev: RetrievedChunk[] = [{ id: "c1", document_id: "d", page: 2, section: "Counters", similarity: 0.9,
    content: "An up counter (CTU) adds one to its accumulated value on each false-to-true transition of its rung, not while the rung stays true." }];
  const good = { type: "mcq", difficulty: "medium", prompt: "When does a CTU count?", options: ["While true", "On each false-to-true transition", "On power up", "Every scan"], correct_option: 1,
    expected_answer: "On each false-to-true transition of its rung.", evidence_chunk_id: "c1", evidence_quote: "adds one to its accumulated value on each false-to-true transition of its rung" };

  it("accepts a well-formed, correctly cited question", () => {
    expect(acceptQuestions([good], ev)).toEqual({ accepted: [expect.objectContaining({ prompt: good.prompt })], rejected: 0 });
  });
  it("rejects MCQs with missing or duplicate options", () => {
    expect(generatedQuestionSchema.safeParse({ ...good, options: null }).success).toBe(false);
    expect(generatedQuestionSchema.safeParse({ ...good, options: ["a", "A", "b", "c"] }).success).toBe(false);
  });
  it("rejects questions citing chunks that weren't retrieved or quotes that aren't in the chunk", () => {
    const r = acceptQuestions([{ ...good, evidence_chunk_id: "made-up" }, { ...good, evidence_quote: "Counters count backwards when the PLC is in program mode." }, "garbage"], ev);
    expect(r).toEqual({ accepted: [], rejected: 3 });
  });
  it("assistant keeps only claims whose quote is found in a retrieved chunk", () => {
    const r = keepVerifiedClaims([
      { text: "CTU counts transitions", chunk_id: "c1", quote: "on each false-to-true transition of its rung" },
      { text: "Invented", chunk_id: "c1", quote: "counters reset themselves every minute automatically" },
    ], ev);
    expect(r.ok).toHaveLength(1);
    expect(r.dropped).toBe(1);
  });
});
