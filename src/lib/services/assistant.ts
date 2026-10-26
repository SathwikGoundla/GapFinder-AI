import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatJson } from "../ai/provider";
import { ASSISTANT_SYSTEM, formatEvidence } from "../ai/prompts";
import { groundedAnswerSchema } from "../ai/schemas";
import { retrieve } from "../rag/retrieve";
import { validateCitation, type RetrievedChunk } from "../rag/citations";

export interface AssistantReply {
  supported: boolean;
  answer: string;
  claims: { text: string; quote: string; source: { title: string; page: number | null; section: string | null } }[];
  inference: string | null;
  droppedClaims: number;
}

export function keepVerifiedClaims(claims: { text: string; chunk_id: string; quote: string }[], retrieved: RetrievedChunk[]) {
  const ok: { text: string; quote: string; chunk: RetrievedChunk }[] = [];
  let dropped = 0;
  for (const c of claims) {
    const v = validateCitation(c.chunk_id, c.quote, retrieved);
    if (v.ok) ok.push({ text: c.text, quote: c.quote, chunk: v.chunk }); else dropped++;
  }
  return { ok, dropped };
}

export async function askAssistant(supabase: SupabaseClient, question: string, topicName: string | null): Promise<AssistantReply> {
  const retrieved = await retrieve(supabase, topicName ? `${topicName}: ${question}` : question);
  if (retrieved.length === 0) {
    return { supported: false, answer: "Your uploaded materials don't contain a passage that clearly answers this. Try rephrasing, or upload notes that cover it.", claims: [], inference: null, droppedClaims: 0 };
  }
  const { data: docs } = await supabase.from("documents").select("id,title").in("id", [...new Set(retrieved.map((r) => r.document_id))]);
  const title = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));
  const out = await chatJson({
    system: ASSISTANT_SYSTEM,
    user: `Question: ${question}\n\n${formatEvidence(retrieved.map((r) => ({ id: r.id, label: `${title.get(r.document_id) ?? "Document"}${r.page ? ` p.${r.page}` : ""}`, content: r.content })))}`,
    schema: groundedAnswerSchema, maxTokens: 1500,
  });
  const { ok, dropped } = keepVerifiedClaims(out.claims, retrieved);
  if (!out.supported || ok.length === 0) {
    return { supported: false, answer: out.supported ? "An answer was drafted but its citations could not be verified against your materials, so it is not shown." : out.answer, claims: [], inference: null, droppedClaims: dropped };
  }
  return {
    supported: true, answer: out.answer, inference: out.inference, droppedClaims: dropped,
    claims: ok.map((c) => ({ text: c.text, quote: c.quote, source: { title: title.get(c.chunk.document_id) ?? "Document", page: c.chunk.page, section: c.chunk.section } })),
  };
}
