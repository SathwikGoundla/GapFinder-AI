import { AppError } from "../errors";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const DOCUMENT_KINDS = ["syllabus", "notes", "textbook", "past_paper"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type AcceptedFormat = "pdf" | "text";

/**
 * Validates by extension, declared MIME type AND file signature.
 * Declared MIME types can lie, so a PDF must start with "%PDF-" and text must not contain NUL bytes.
 */
export function validateUpload(input: { name: string; type: string; size: number; head: Uint8Array }): AcceptedFormat {
  const name = input.name.toLowerCase();
  if (input.size <= 0) throw new AppError("FILE_INVALID", "The file is empty.");
  if (input.size > MAX_FILE_BYTES) throw new AppError("FILE_INVALID", "The file is larger than 10 MB. Split it into smaller parts.");

  if (name.endsWith(".pdf")) {
    if (input.type && input.type !== "application/pdf" && input.type !== "application/octet-stream") {
      throw new AppError("FILE_INVALID", "The file has a .pdf name but is not a PDF.");
    }
    const sig = new TextDecoder("latin1").decode(input.head.slice(0, 5));
    if (sig !== "%PDF-") throw new AppError("FILE_INVALID", "This PDF looks damaged or is not a real PDF file.");
    return "pdf";
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    if (input.head.includes(0)) throw new AppError("FILE_INVALID", "This text file contains binary data.");
    return "text";
  }
  throw new AppError("FILE_INVALID", "Only PDF, .txt and .md files are supported.");
}

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === "string" && (DOCUMENT_KINDS as readonly string[]).includes(v);
}
