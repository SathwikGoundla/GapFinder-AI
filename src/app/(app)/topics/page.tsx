import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { TopicEditor } from "@/components/topic-editor";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/notice";
import { formatSource, type TopicRow } from "@/lib/types";

export const metadata: Metadata = { title: "Topic map" };
type Src = { topic_id: string; chunks: { id: string; page: number | null; section: string | null; documents: { title: string } | null } | null };

const ORIGIN = {
  syllabus: { label: "In syllabus", cls: "bg-accent-tint text-accent" },
  inferred: { label: "Found in notes", cls: "bg-unknown-tint text-unknown" },
  manual: { label: "Edited by you", cls: "bg-developing-tint text-developing" },
} as const;

export default async function Topics() {
  const supabase = await createClient();
  const [{ data: t }, { data: s }, { count: docCount }] = await Promise.all([
    supabase.from("topics").select("*").order("position"),
    supabase.from("topic_sources").select("topic_id,chunks(id,page,section,documents(title))"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "ready"),
  ]);
  const topics = (t ?? []) as TopicRow[];
  const sources = (s ?? []) as unknown as Src[];
  if (topics.length === 0) {
    return (
      <>
        <PageHeader title="Topic map" />
        {(docCount ?? 0) === 0
          ? <EmptyState title="No materials yet" action={<Link href="/library" className={buttonStyles()}>Add materials</Link>}>Upload a syllabus or notes, then build the map.</EmptyState>
          : <EmptyState title="Build your topic map" action={<ActionButton url="/api/topics/build" pendingLabel="Reading your materials…">Build topic map</ActionButton>}>
              The AI lists topics from your materials. Topics only count as &ldquo;in syllabus&rdquo; if a syllabus passage supports them — this is checked by the app, not trusted from the AI.
            </EmptyState>}
      </>
    );
  }
  const name = new Map(topics.map((x) => [x.id, x.name]));
  const roots = topics.filter((x) => !x.parent_id || !name.has(x.parent_id));
  const kids = (id: string) => topics.filter((x) => x.parent_id === id);
  const parents = roots.map((r) => ({ id: r.id, name: r.name }));

  const Row = ({ topic, depth }: { topic: TopicRow; depth: number }) => {
    const src = sources.filter((x) => x.topic_id === topic.id && x.chunks);
    return (
      <li className={depth ? "border-l-2 border-line pl-4" : ""}>
        <div className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={depth ? "font-medium" : "font-display text-lg"}>{topic.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${ORIGIN[topic.origin].cls}`}>{ORIGIN[topic.origin].label}</span>
            </div>
            {topic.description && <p className="mt-0.5 text-sm text-ink-soft">{topic.description}</p>}
            {topic.prerequisite_ids.length > 0 && <p className="mt-1 text-xs text-ink-faint">Learn first: {topic.prerequisite_ids.map((p) => name.get(p)).filter(Boolean).join(", ")}</p>}
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer text-ink-faint hover:text-ink">{src.length} source passage{src.length === 1 ? "" : "s"}</summary>
              {src.length === 0 ? <p className="mt-1 text-ink-faint">No linked passages. Questions will rely on search.</p> : (
                <ul className="mt-1 list-disc pl-5 text-ink-soft">{src.map((x) => <li key={x.chunks!.id}>{formatSource({ title: x.chunks!.documents?.title ?? "Document", page: x.chunks!.page, section: x.chunks!.section })}</li>)}</ul>
              )}
            </details>
          </div>
          <TopicEditor id={topic.id} name={topic.name} parentId={topic.parent_id} parents={parents} />
        </div>
        {kids(topic.id).length > 0 && <ul className="ml-1">{kids(topic.id).map((k) => <Row key={k.id} topic={k} depth={depth + 1} />)}</ul>}
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Topic map" description="Check the topics look right before quizzing. Rename or move anything that's wrong — your edits are kept."
        actions={<>
          <Link href="/quiz" className={buttonStyles()}>Quiz on these topics</Link>
          <ActionButton url="/api/topics/build" body={{ replace: true }} variant="secondary" pendingLabel="Rebuilding…"
            confirm="Rebuilding replaces every topic and deletes quiz history linked to them. Continue?">Rebuild</ActionButton>
        </>} />
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface px-5">{roots.map((r) => <Row key={r.id} topic={r} depth={0} />)}</ul>
    </>
  );
}
