import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { validateUpload, MAX_FILE_BYTES } from "@/lib/ingest/validate";
import { extractPages, normalizeText } from "@/lib/ingest/extract";
import { chunkPages, isHeading } from "@/lib/ingest/chunk";
import { SAMPLE_DOCUMENTS } from "@/data/samples";

const enc = (s: string) => new TextEncoder().encode(s);
const pdf = new Uint8Array(readFileSync("tests/fixtures/two-pages.pdf"));
const fake = new Uint8Array(readFileSync("tests/fixtures/fake.pdf"));

describe("file validation", () => {
  it("accepts a real PDF by signature", () => {
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: pdf.length, head: pdf.slice(0, 1024) })).toBe("pdf");
  });
  it("rejects a file that only claims to be a PDF", () => {
    expect(() => validateUpload({ name: "a.pdf", type: "application/pdf", size: fake.length, head: fake })).toThrow(/damaged or is not a real PDF/);
  });
  it("rejects empty, oversized and unsupported files", () => {
    expect(() => validateUpload({ name: "a.txt", type: "text/plain", size: 0, head: new Uint8Array() })).toThrow(/empty/);
    expect(() => validateUpload({ name: "a.txt", type: "text/plain", size: MAX_FILE_BYTES + 1, head: enc("x") })).toThrow(/10 MB/);
    expect(() => validateUpload({ name: "a.docx", type: "application/zip", size: 10, head: enc("PK") })).toThrow(/Only PDF/);
  });
  it("rejects binary content disguised as text", () => {
    expect(() => validateUpload({ name: "a.txt", type: "text/plain", size: 4, head: new Uint8Array([65, 0, 66, 0]) })).toThrow(/binary/);
  });
});

describe("text extraction", () => {
  it("extracts PDF text per page with page numbers", async () => {
    const pages = await extractPages(pdf, "pdf");
    expect(pages.map((p) => p.page)).toEqual([1, 2]);
    expect(pages[0]!.text).toContain("input image table");
    expect(pages[1]!.text).toContain("on-delay timer");
  });
  it("fails clearly on a corrupt PDF", async () => {
    await expect(extractPages(new Uint8Array([...enc("%PDF-1.4 garbage")]), "pdf")).rejects.toThrow(/could not be read/);
  });
  it("reports empty documents instead of silently succeeding", async () => {
    await expect(extractPages(enc("   \n\n  "), "text")).rejects.toMatchObject({ code: "EXTRACTION_EMPTY" });
  });
  it("rejects invalid UTF-8 text", async () => {
    await expect(extractPages(new Uint8Array([0xff, 0xfe, 0xfd]), "text")).rejects.toThrow(/UTF-8/);
  });
  it("normalizes whitespace but keeps paragraphs", () => {
    expect(normalizeText("A  b\r\n\r\n\r\nhyph-\nenated")).toBe("A b\n\nhyphenated");
  });
});

describe("chunking", () => {
  it("detects headings", () => {
    expect(isHeading("## Seal-in Circuits")).toBe(true);
    expect(isHeading("1.4 The PLC scan cycle")).toBe(true);
    expect(isHeading("This is an ordinary sentence.")).toBe(false);
  });
  it("preserves page and section metadata and never crosses pages", () => {
    const chunks = chunkPages(
      [{ page: 1, text: "## Scan Cycle\n\n" + "Inputs are copied to the image table. ".repeat(30) }, { page: 2, text: "## Timers\n\n" + "A TON times while its rung is true. ".repeat(10) }],
      { size: 400, overlap: 80 },
    );
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(400 + 80);
    expect(chunks.filter((c) => c.page === 1).every((c) => c.section === "Scan Cycle")).toBe(true);
    expect(chunks.filter((c) => c.page === 2).every((c) => c.section === "Timers" && !c.content.includes("image table"))).toBe(true);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });
  it("chunks the sample notes into sections that keep their headings", () => {
    const notes = SAMPLE_DOCUMENTS.find((d) => d.kind === "notes")!;
    const chunks = chunkPages([{ page: null, text: normalizeText(notes.content) }], { size: 1200, overlap: 200 });
    expect(chunks.length).toBeGreaterThanOrEqual(6);
    expect(new Set(chunks.map((c) => c.section))).toContain("The Scan Cycle");
    expect(chunks.find((c) => c.content.includes("seal-in (latching) contact"))?.section).toBe("Seal-in Circuits");
  });
  it("rejects overlap >= size", () => {
    expect(() => chunkPages([{ page: 1, text: "x".repeat(100) }], { size: 100, overlap: 100 })).toThrow();
  });
});
