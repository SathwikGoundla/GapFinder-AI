import { AppError } from "../errors";
import type { AcceptedFormat } from "./validate";

export interface ExtractedPage { page: number | null; text: string }

/** Normalizes whitespace but keeps paragraph breaks and heading lines, which chunking relies on. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00ad/g, "")              // soft hyphens
    .replace(/(\w)-\n(\w)/g, "$1$2")     // words broken across lines
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPages(bytes: Uint8Array, format: AcceptedFormat): Promise<ExtractedPage[]> {
  let pages: ExtractedPage[];
  if (format === "text") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AppError("FILE_INVALID", "This text file is not valid UTF-8.");
    }
    pages = [{ page: null, text: normalizeText(text) }];
  } else {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: false });
      pages = (text as string[]).map((t, i) => ({ page: i + 1, text: normalizeText(t) }));
    } catch {
      throw new AppError("FILE_INVALID", "The PDF could not be read. It may be encrypted or damaged.");
    }
  }
  pages = pages.filter((p) => p.text.length > 0);
  const total = pages.reduce((n, p) => n + p.text.length, 0);
  if (total < 40) {
    throw new AppError(
      "EXTRACTION_EMPTY",
      "No readable text was found. If this is a scanned PDF, run OCR first or upload a text version.",
    );
  }
  return pages;
}
