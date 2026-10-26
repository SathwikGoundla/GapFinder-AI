import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors";
import { chatJson } from "../ai/provider";
import { TOPIC_MAP_SYSTEM, formatEvidence } from "../ai/prompts";
import { topicMapSchema, type TopicMapOutput } from "../ai/schemas";

interface ChunkLite { id: string; content: string; page: number | null; section: string | null; document_id: string; documents: { title: string; kind: string } | null }

/** Picks a context-sized, evenly spread sample: all syllabus chunks first, then the rest. */
export function sampleChunks<T extends { documents: { kind: string } | null }>(chunks: T[], max = 60): T[] {
  const syl = chunks.filter((c) => c.documents?.kind === "syllabus");
  const rest = chunks.filter((c) => c.documents?.kind !== "syllabus");
  const room = Math.max(0, max - syl.length);
  const step = rest.length > room && room > 0 ? rest.length / room : 1;
  const picked: T[] = [];
  for (let i = 0; i < rest.length && picked.length < room; i += step) picked.push(rest[Math.floor(i)]!);
  return [...syl.slice(0, max), ...picked];
}

/**
 * Deterministic post-processing of the model's topic map:
 * - drops cited chunk ids that were not shown to the model
 * - downgrades "syllabus" to "inferred" unless at least one cited chunk comes from a syllabus document
 */
export function sanitizeTopicMap(out: TopicMapOutput, shown: Map<string, { kind: string }>) {
  const seen = new Set<string>();
  return out.topics
    .filter((t) => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((t) => {
      const ids = t.source_chunk_ids.filter((id) => shown.has(id));
      const fromSyllabus = ids.some((id) => shown.get(id)?.kind === "syllabus");
      return { ...t, source_chunk_ids: ids, origin: t.origin === "syllabus" && fromSyllabus ? "syllabus" as const : "inferred" as const };
    });
}

export function buildFallbackTopics(sample: ChunkLite[]): TopicMapOutput["topics"] {
  const map = new Map<string, { description: string; origin: "syllabus" | "inferred"; chunkIds: string[] }>();
  for (const c of sample) {
    let name = "";
    if (c.section && c.section.trim().length > 2 && c.section.trim().length <= 80) {
      name = c.section.trim();
    } else {
      const firstLine = c.content.split("\n")[0]?.replace(/^[#*\s\d.-]+/, "").trim() ?? "";
      if (firstLine.length > 3 && firstLine.length <= 80) {
        name = firstLine;
      } else {
        const docTitle = c.documents?.title ?? "Core Topic";
        name = `${docTitle}${c.page ? ` Part ${c.page}` : ""}`;
      }
    }
    name = name.replace(/[:.,;]+$/, "").trim().slice(0, 80);
    if (!name) continue;

    const isSyllabus = c.documents?.kind === "syllabus";
    const existing = map.get(name.toLowerCase());
    if (existing) {
      if (existing.chunkIds.length < 6 && !existing.chunkIds.includes(c.id)) {
        existing.chunkIds.push(c.id);
      }
      if (isSyllabus) existing.origin = "syllabus";
    } else {
      const desc = c.content.replace(/\s+/g, " ").trim().slice(0, 250);
      map.set(name.toLowerCase(), {
        description: desc,
        origin: isSyllabus ? "syllabus" : "inferred",
        chunkIds: [c.id],
      });
    }
    if (map.size >= 15) break;
  }

  if (map.size === 0) {
    for (const c of sample) {
      const docTitle = c.documents?.title || "Course Material";
      map.set(docTitle.toLowerCase(), {
        description: c.content.slice(0, 200),
        origin: c.documents?.kind === "syllabus" ? "syllabus" : "inferred",
        chunkIds: [c.id],
      });
      break;
    }
  }

  return Array.from(map.entries()).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    description: v.description,
    origin: v.origin,
    parent: null,
    prerequisites: [] as string[],
    source_chunk_ids: v.chunkIds,
  }));
}

export async function buildTopicMap(supabase: SupabaseClient, userId: string, opts: { replace: boolean }) {
  const { count } = await supabase.from("topics").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !opts.replace) throw new AppError("CONFLICT", "A topic map already exists. Confirm to rebuild it.");

  const { data, error } = await supabase.from("chunks").select("id,content,page,section,document_id,documents(title,kind)").order("ordinal").limit(800);
  if (error) throw new AppError("DB_FAILED", "Could not load your materials.");
  const chunks = (data ?? []) as unknown as ChunkLite[];
  if (chunks.length === 0) throw new AppError("NO_EVIDENCE", "Upload at least one document before building a topic map.");

  const sample = sampleChunks(chunks, 18);
  const shown = new Map(sample.map((c) => [c.id, { kind: c.documents?.kind ?? "notes" }]));
  const evidence = formatEvidence(sample.map((c) => ({
    id: c.id, label: `${c.documents?.kind ?? "notes"}: ${c.documents?.title ?? "Untitled"}${c.page ? `, p.${c.page}` : ""}`,
    content: c.content.slice(0, 450),
  })));

  let topics: ReturnType<typeof sanitizeTopicMap>;
  try {
    const out = await chatJson({ system: TOPIC_MAP_SYSTEM, user: `Build the topic map.\n\n${evidence}`, schema: topicMapSchema, maxTokens: 800 });
    topics = sanitizeTopicMap(out, shown);
  } catch (err: unknown) {
    if (err instanceof AppError && (err.code === "AI_RATE_LIMITED" || err.code === "AI_FAILED" || err.code === "AI_TIMEOUT" || err.code === "AI_BAD_OUTPUT")) {
      console.warn("AI topic map generation hit an issue (" + err.code + "); falling back to local content extraction:", err.message);
      const fallbackTopics = buildFallbackTopics(sample);
      topics = sanitizeTopicMap({ topics: fallbackTopics }, shown);
    } else {
      throw err;
    }
  }

  if (opts.replace) {
    const { error: delErr } = await supabase.from("topics").delete().eq("user_id", userId);
    if (delErr) throw new AppError("DB_FAILED", "Could not replace the old topic map.");
  }
  // Insert parents first, then children, then resolve prerequisite names to ids.
  const idByName = new Map<string, string>();
  const ordered = [...topics.filter((t) => !t.parent), ...topics.filter((t) => t.parent)];
  for (const [i, t] of ordered.entries()) {
    const parentId = t.parent ? idByName.get(t.parent.toLowerCase()) ?? null : null;
    const { data: row, error: e } = await supabase.from("topics")
      .insert({ user_id: userId, name: t.name, description: t.description, origin: t.origin, parent_id: parentId, position: i })
      .select("id").single();
    if (e || !row) throw new AppError("DB_FAILED", "Could not save the topic map.");
    idByName.set(t.name.toLowerCase(), row.id);
    if (t.source_chunk_ids.length) await supabase.from("topic_sources").insert(t.source_chunk_ids.map((cid) => ({ topic_id: row.id, chunk_id: cid, user_id: userId })));
  }
  for (const t of ordered) {
    const pre = t.prerequisites.map((p) => idByName.get(p.toLowerCase())).filter((x): x is string => Boolean(x));
    const id = idByName.get(t.name.toLowerCase());
    if (pre.length && id) await supabase.from("topics").update({ prerequisite_ids: pre.filter((p) => p !== id) }).eq("id", id);
  }
  return { topics: ordered.length };
}
