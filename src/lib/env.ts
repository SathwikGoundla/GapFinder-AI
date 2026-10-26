import { z } from "zod";
import { AppError } from "./errors";

const aiSchema = z.object({
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(8),
  AI_CHAT_MODEL: z.string().min(1),
  AI_EMBEDDING_MODEL: z.string().min(1),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
});

const ragSchema = z.object({
  RAG_CHUNK_SIZE: z.coerce.number().int().min(300).max(4000).default(1200),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(1000).default(200),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.55),
});

export type AiEnv = z.infer<typeof aiSchema>;
export type RagEnv = z.infer<typeof ragSchema>;

/** Validated lazily so `next build` works without secrets; fails clearly at request time. */
export function getAiEnv(source: Record<string, string | undefined> = process.env): AiEnv {
  const parsed = aiSchema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new AppError("AI_NOT_CONFIGURED", `The AI provider is not configured (check: ${missing}). See RUN_INSTRUCTIONS.md.`, { retryable: false });
  }
  return parsed.data;
}

export function getRagEnv(source: Record<string, string | undefined> = process.env): RagEnv {
  return ragSchema.parse(source);
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new AppError("DB_FAILED", "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", { retryable: false });
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
