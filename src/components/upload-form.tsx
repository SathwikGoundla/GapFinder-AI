"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";

const KINDS = [["syllabus", "Syllabus"], ["notes", "Notes"], ["textbook", "Textbook chapter"], ["past_paper", "Past paper"]] as const;

export function UploadForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; ok?: string }>({ busy: false });
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setState({ busy: false, error: "Choose a file first." });
    if (file.size > 10 * 1024 * 1024) return setState({ busy: false, error: "That file is over 10 MB. Split it into smaller parts." });
    setState({ busy: true });
    try {
      const r = await api<{ chunks: number }>("/api/documents", { method: "POST", body: form });
      setState({ busy: false, ok: `Uploaded and split into ${r.chunks} searchable sections.` });
      ref.current?.reset();
      router.refresh();
    } catch (err) {
      setState({ busy: false, error: err instanceof ClientApiError ? err.message : "Upload failed." });
    }
  };
  return (
    <form ref={ref} onSubmit={submit} className="panel grid gap-4 p-5 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="file" className="label">File (PDF, .txt or .md, up to 10 MB)</label>
        <input id="file" name="file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" required className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-accent-tint file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent" />
      </div>
      <div>
        <label htmlFor="kind" className="label">Type</label>
        <select id="kind" name="kind" className="field" defaultValue="notes">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <div>
        <label htmlFor="title" className="label">Title (optional)</label>
        <input id="title" name="title" maxLength={200} className="field" placeholder="Uses the file name if empty" />
      </div>
      <Button type="submit" busy={state.busy}>{state.busy ? "Processing…" : "Upload"}</Button>
      <div className="sm:col-span-4" aria-live="polite">
        {state.busy && <p className="text-sm text-ink-soft">Reading the text, splitting it into sections and indexing it for search. Large PDFs take up to a minute.</p>}
        {state.error && <p role="alert" className="text-sm text-weak">{state.error}</p>}
        {state.ok && <p className="text-sm text-strong">{state.ok}</p>}
      </div>
    </form>
  );
}
