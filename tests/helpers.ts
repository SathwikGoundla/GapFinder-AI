import type { AiEnv } from "@/lib/env";

export const TEST_ENV: AiEnv = { AI_BASE_URL: "https://ai.test/v1", AI_API_KEY: "test-key-123", AI_CHAT_MODEL: "m", AI_EMBEDDING_MODEL: "e", AI_EMBEDDING_DIMENSIONS: 3 };
export const noSleep = async () => {};

/** Mock fetch that returns queued responses in order and records calls. Used ONLY in tests. */
export function mockFetch(responses: { status: number; body?: unknown }[]) {
  const calls: { url: string; body: unknown }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const r = responses.shift();
    if (!r) throw new Error("no more mock responses");
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

export const chatReply = (content: string, finish = "stop") => ({ status: 200, body: { choices: [{ message: { content }, finish_reason: finish }] } });
