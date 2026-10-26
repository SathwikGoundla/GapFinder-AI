import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { UploadForm } from "@/components/upload-form";
import { PageHeader } from "@/components/ui/notice";
import { fmtDate } from "@/lib/utils";
import type { DocumentRow } from "@/lib/types";

export const metadata: Metadata = { title: "Materials" };
const KIND_LABEL = { syllabus: "Syllabus", notes: "Notes", textbook: "Textbook", past_paper: "Past paper" } as const;

export default async function Library() {
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
  const docs = (data ?? []) as DocumentRow[];
  const hasDemo = docs.some((d) => d.is_demo);
  return (
    <>
      <PageHeader title="Materials" description="Everything GapFinder quizzes you on comes from these files. Only you can see them."
        actions={!hasDemo && <ActionButton url="/api/demo/samples" variant="secondary" pendingLabel="Loading…" successMessage="Sample course added.">Add sample PLC course</ActionButton>} />
      <UploadForm />
      <section aria-labelledby="docs" className="mt-10">
        <h2 id="docs" className="sr-only">Your documents</h2>
        {docs.length === 0 ? <p className="text-ink-soft">No materials yet. Upload a syllabus first — it helps GapFinder tell official topics apart from extra ones.</p> : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}{d.is_demo && <span className="ml-2 rounded bg-accent-tint px-1.5 py-0.5 text-xs text-accent">Demo content</span>}</p>
                  <p className="text-sm text-ink-faint">
                    {KIND_LABEL[d.kind]} · {d.file_name} · {(d.size_bytes / 1024).toFixed(0)} KB{d.page_count ? ` · ${d.page_count} pages` : ""} · added {fmtDate(d.created_at)}
                  </p>
                  {d.status === "failed" && <p role="alert" className="mt-1 text-sm text-weak">{d.error ?? "Processing failed."} Delete it and upload again.</p>}
                  {d.status === "processing" && (Date.now() - new Date(d.created_at).getTime() > 120_000
                    ? <p role="alert" className="mt-1 text-sm text-weak">Processing did not finish. Upload the file again to retry, or delete it.</p>
                    : <p className="mt-1 text-sm text-developing">Processing… refresh in a moment.</p>)}
                </div>
                <ActionButton url={`/api/documents/${d.id}`} method="DELETE" variant="danger" size="sm"
                  confirm={`Delete "${d.title}"? Questions and topic links that use it will also be removed.`}>Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
