import { z } from "zod";
import { AppError } from "../errors";
import { getAiEnv, type AiEnv } from "../env";

type FetchLike = typeof fetch;
// Worst case per call stays well under the 60 s serverless limit (verified in audit: 3×45 s took 138 s).
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2; // bounded: at most 3 attempts for 429/5xx/network errors; a timeout is not retried

export interface ProviderDeps { env?: AiEnv; fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void> }

function parseRetryAfter(res: Response): number | null {
  const header = res.headers?.get ? res.headers.get("retry-after") : null;
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : null;
  }
  return null;
}

async function call(
  path: string,
  body: unknown,
  deps: ProviderDeps,
  options?: { baseUrl?: string; apiKey?: string },
): Promise<unknown> {
  const env = deps.env ?? getAiEnv();
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const baseUrl = (options?.baseUrl ?? env.AI_BASE_URL).replace(/\/$/, "");
  const apiKey = options?.apiKey ?? env.AI_API_KEY;
  let lastErr: AppError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let retryAfterMs: number | null = null;
    let isRateLimit = false;

    try {
      const res = await doFetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`AI_PROVIDER_ERROR (HTTP ${res.status}):`, errText);
        if (res.status === 401 || res.status === 403) {
          throw new AppError("AI_NOT_CONFIGURED", "The AI provider rejected the API key. Check AI_API_KEY.", { retryable: false });
        }
        if (res.status === 429) {
          isRateLimit = true;
          retryAfterMs = parseRetryAfter(res);
          lastErr = new AppError("AI_RATE_LIMITED", "The AI provider is rate-limiting requests. Wait a minute and try again.");
        } else {
          lastErr = new AppError("AI_FAILED", `The AI provider returned an error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
        }
        if (res.status < 500 && res.status !== 429) throw lastErr;
      } else {
        return await res.json();
      }
    } catch (e) {
      if (e instanceof AppError && !e.retryable) throw e;
      if (e instanceof AppError) lastErr = e;
      else if (e instanceof Error && e.name === "AbortError") throw new AppError("AI_TIMEOUT", "The AI provider took too long to respond. Try again.");
      else lastErr = new AppError("AI_FAILED", "Could not reach the AI provider. Check your network connection.");
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_RETRIES) {
      if (isRateLimit) {
        const delay = retryAfterMs != null ? Math.min(Math.max(retryAfterMs, 1000), 10_000) : Math.min(2000 * 2 ** attempt, 8000);
        await sleep(delay);
      } else {
        await sleep(800 * 2 ** attempt);
      }
    }
  }
  throw lastErr ?? new AppError("AI_FAILED", "The AI request failed.");
}

/** Extracts the first JSON object from model text (handles ```json fences and stray prose). */
export function parseJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AppError("AI_BAD_OUTPUT", "The AI returned an unreadable response. Try again.");
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new AppError("AI_BAD_OUTPUT", "The AI returned incomplete JSON (the response may have been cut off). Try again.");
  }
}

const chatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable().optional() })).min(1),
});

/** Chat completion whose output must match `schema`. Invalid output is rejected, never shown. */
export async function chatJson<T>(
  args: { system: string; user: string; schema: z.ZodType<T, z.ZodTypeDef, unknown>; maxTokens?: number },
  deps: ProviderDeps = {},
): Promise<T> {
  const env = deps.env ?? getAiEnv();
  const groqKey = process.env.GROQ_API_KEY;
  const chatBaseUrl = groqKey ? (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1") : undefined;
  const chatApiKey = groqKey || undefined;
  const chatModel = groqKey ? (process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b") : env.AI_CHAT_MODEL;

  const raw = await call("/chat/completions", {
    model: chatModel,
    temperature: 0.2,
    max_tokens: Math.min(args.maxTokens ?? 800, groqKey ? 800 : 2500),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.system + "\nRespond with a single JSON object only. No markdown." },
      { role: "user", content: args.user },
    ],
  }, { ...deps, env }, chatBaseUrl && chatApiKey ? { baseUrl: chatBaseUrl, apiKey: chatApiKey } : undefined);
  const parsed = chatResponse.safeParse(raw);
  const choice = parsed.success ? parsed.data.choices[0] : undefined;
  if (!choice?.message.content) throw new AppError("AI_BAD_OUTPUT", "The AI returned an empty response. Try again.");
  if (choice.finish_reason === "length") throw new AppError("AI_BAD_OUTPUT", "The AI response was cut off. Try again with fewer topics.");
  const rawJson = parseJsonObject(choice.message.content);
  const result = args.schema.safeParse(rawJson);
  if (!result.success) {
    console.error("ZOD_VALIDATION_ERROR:", JSON.stringify(result.error.issues, null, 2));
    console.error("RAW_JSON:", JSON.stringify(rawJson).slice(0, 500));
    throw new AppError("AI_BAD_OUTPUT", "The AI response did not match the expected format. Try again.");
  }
  return result.data;
}

const embedResponse = z.object({ data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().optional() })) });

export async function embed(texts: string[], deps: ProviderDeps = {}): Promise<number[][]> {
  const env = deps.env ?? getAiEnv();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const out: number[][] = [];
  const BATCH_SIZE = 32;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(250);
    const batch = texts.slice(i, i + BATCH_SIZE);
    const raw = await call("/embeddings", { model: env.AI_EMBEDDING_MODEL, input: batch, dimensions: env.AI_EMBEDDING_DIMENSIONS }, { ...deps, env });
    const parsed = embedResponse.safeParse(raw);
    if (!parsed.success || parsed.data.data.length !== batch.length) {
      throw new AppError("AI_BAD_OUTPUT", "The embedding provider returned an unexpected response.");
    }
    for (const row of parsed.data.data) {
      if (row.embedding.length !== env.AI_EMBEDDING_DIMENSIONS) {
        throw new AppError("AI_BAD_OUTPUT", `Embedding size ${row.embedding.length} does not match AI_EMBEDDING_DIMENSIONS=${env.AI_EMBEDDING_DIMENSIONS}.`, { retryable: false });
      }
      out.push(row.embedding);
    }
  }
  return out;
}
