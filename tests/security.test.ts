import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parseInput, createQuizInput, submitQuizInput, createPlanInput } from "@/lib/validation";
import { isProtectedPath } from "@/lib/supabase/middleware";
import { assertOwner } from "@/lib/auth";
import { toErrorBody, AppError } from "@/lib/errors";
import { sanitizeTopicMap } from "@/lib/services/topics";

describe("API input validation", () => {
  it("rejects bad quiz input with a useful message", () => {
    expect(() => parseInput(createQuizInput, { topicIds: ["not-a-uuid"], idempotencyKey: "12345678" })).toThrow(/topicIds/);
    expect(() => parseInput(createQuizInput, { topicIds: [], idempotencyKey: "12345678" })).toThrow();
    expect(() => parseInput(createQuizInput, null)).toThrow(/Invalid input/);
  });
  it("limits answer length and option index", () => {
    const id = "6b8e3c1a-2f4d-4e5a-9b7c-1d2e3f4a5b6c";
    expect(() => parseInput(submitQuizInput, { answers: [{ questionId: id, selectedOption: 7 }] })).toThrow();
    expect(() => parseInput(submitQuizInput, { answers: [{ questionId: id, response: "x".repeat(2001) }] })).toThrow();
    expect(parseInput(submitQuizInput, { answers: [{ questionId: id }] }).answers[0]).toEqual({ questionId: id, selectedOption: null, response: null });
  });
  it("validates plan dates and minutes", () => {
    expect(() => parseInput(createPlanInput, { examDate: "10/11/2026", dailyMinutes: 60 })).toThrow(/YYYY-MM-DD/);
    expect(() => parseInput(createPlanInput, { examDate: "2026-11-10", dailyMinutes: 5 })).toThrow();
  });
});

describe("authorization boundaries", () => {
  it("protects every app route and leaves public pages open", () => {
    for (const p of ["/dashboard", "/library", "/quiz/abc", "/report", "/plan", "/settings"]) expect(isProtectedPath(p)).toBe(true);
    for (const p of ["/", "/login", "/signup", "/auth/callback", "/quizzes-public"]) expect(isProtectedPath(p)).toBe(false);
  });
  it("refuses access to another user's record", () => {
    expect(() => assertOwner({ user_id: "other" }, "me", "document")).toThrow(/do not have access/);
    expect(() => assertOwner(null, "me", "document")).toThrow(/not found/);
    expect(() => assertOwner({ user_id: "me" }, "me")).not.toThrow();
  });
  it("enables row-level security with owner policies on every user table", () => {
    const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");
    for (const t of ["documents", "chunks", "topics", "topic_sources", "quiz_sessions", "questions", "answers", "topic_assessments", "revision_plans", "revision_sessions"]) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/c\.user_id = auth\.uid\(\)/);
  });
  it("does not leak internal error details", () => {
    const { status, body } = toErrorBody(new Error("duplicate key value violates constraint secret_table"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret_table");
    expect(toErrorBody(new AppError("NOT_FOUND", "That quiz was not found.")).status).toBe(404);
  });
  it("never ships real secrets in .env.example", () => {
    const env = readFileSync(".env.example", "utf8");
    expect(env).not.toMatch(/sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{30,}/);
  });
});

describe("topic map sanitizing", () => {
  it("only keeps 'in syllabus' when a cited passage comes from a syllabus, and drops invented ids", () => {
    const shown = new Map([["s1", { kind: "syllabus" }], ["n1", { kind: "notes" }]]);
    const out = sanitizeTopicMap({ topics: [
      { name: "Scan cycle", description: "", origin: "syllabus", parent: null, prerequisites: [], source_chunk_ids: ["s1", "fake"] },
      { name: "Analog scaling", description: "", origin: "syllabus", parent: null, prerequisites: [], source_chunk_ids: ["n1"] },
      { name: "scan cycle", description: "", origin: "inferred", parent: null, prerequisites: [], source_chunk_ids: [] },
    ] }, shown);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ origin: "syllabus", source_chunk_ids: ["s1"] });
    expect(out[1]).toMatchObject({ origin: "inferred" });
  });
});
