import { describe, it, expect } from "vitest";
import { validateCitation, quoteSupport, type RetrievedChunk } from "@/lib/rag/citations";
import { filterRetrieved } from "@/lib/rag/retrieve";

const chunk = (id: string, content: string, sim = 0.8, doc = "d1"): RetrievedChunk => ({ id, document_id: doc, content, page: 3, section: "Timers", similarity: sim });
const TON = chunk("c1", "An on-delay timer (TON) starts timing when its rung becomes true. When the accumulated time reaches the preset, the done bit turns on.");

describe("citation validation", () => {
  it("accepts a verbatim quote from a retrieved chunk", () => {
    const r = validateCitation("c1", "When the accumulated time reaches the preset, the done bit turns on.", [TON]);
    expect(r.ok).toBe(true);
  });
  it("tolerates whitespace, case and curly-quote differences", () => {
    expect(quoteSupport("an ON-DELAY  timer (TON)   starts timing", TON.content)).toBe(1);
  });
  it("rejects a chunk id that was not retrieved (fabricated citation)", () => {
    expect(validateCitation("c999", "starts timing", [TON])).toEqual({ ok: false, reason: "unknown_chunk" });
  });
  it("rejects a quote that is not in the cited chunk, even if the chunk is real", () => {
    expect(validateCitation("c1", "A retentive timer keeps its accumulated value when the rung goes false.", [TON])).toEqual({ ok: false, reason: "quote_not_found" });
  });
});

describe("retrieval filtering", () => {
  it("drops results below the similarity threshold", () => {
    const out = filterRetrieved([chunk("a", "alpha ".repeat(30), 0.9), chunk("b", "beta ".repeat(30), 0.4)], { minSimilarity: 0.55, topK: 5 });
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });
  it("removes near-duplicates caused by chunk overlap and sorts by similarity", () => {
    const base = "The scan cycle reads inputs once per scan and then solves the ladder logic from top to bottom. ".repeat(3);
    const out = filterRetrieved([chunk("x", base, 0.7), chunk("y", base + " extra", 0.9), chunk("z", "different text ".repeat(20), 0.8)], { minSimilarity: 0.5, topK: 5 });
    expect(out.map((c) => c.id)).toEqual(["y", "z"]);
  });
  it("caps chunks per document so one document can't crowd out others", () => {
    const rows = [1, 2, 3, 4].map((i) => chunk(`d1-${i}`, `unique content number ${i} `.repeat(10), 0.9 - i / 100)).concat(chunk("d2", "other doc ".repeat(20), 0.6, "d2"));
    const out = filterRetrieved(rows, { minSimilarity: 0.5, topK: 4, maxPerDocument: 2 });
    expect(out.filter((c) => c.document_id === "d1")).toHaveLength(2);
    expect(out.some((c) => c.document_id === "d2")).toBe(true);
  });
});
