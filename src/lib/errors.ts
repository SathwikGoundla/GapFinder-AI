/** Errors that are safe to show to the student. Anything else becomes a generic message. */
export type ErrorCode =
  | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "FILE_INVALID" | "EXTRACTION_EMPTY"
  | "DUPLICATE" | "AI_NOT_CONFIGURED" | "AI_RATE_LIMITED" | "AI_TIMEOUT" | "AI_BAD_OUTPUT" | "AI_FAILED"
  | "NO_EVIDENCE" | "DB_FAILED" | "CONFLICT";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, FILE_INVALID: 400,
  EXTRACTION_EMPTY: 422, DUPLICATE: 409, AI_NOT_CONFIGURED: 503, AI_RATE_LIMITED: 429,
  AI_TIMEOUT: 504, AI_BAD_OUTPUT: 502, AI_FAILED: 502, NO_EVIDENCE: 422, DB_FAILED: 500, CONFLICT: 409,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  constructor(code: ErrorCode, message: string, opts: { retryable?: boolean } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.retryable = opts.retryable ?? ["AI_RATE_LIMITED", "AI_TIMEOUT", "AI_FAILED", "DB_FAILED"].includes(code);
  }
}

export function toErrorBody(err: unknown): { status: number; body: { error: { code: string; message: string; retryable: boolean } } } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, retryable: err.retryable } } };
  }
  // Never leak internals (stack traces, SQL, document text) to the client.
  console.error("[unhandled]", err instanceof Error ? err.name + ": " + err.message.slice(0, 200) : "unknown");
  return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong on the server. Try again.", retryable: true } } };
}
