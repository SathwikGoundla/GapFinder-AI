"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/status";
import { api, ClientApiError } from "@/lib/client-api";
import type { GapStatus } from "@/lib/scoring/gap";

export function QuizStarter({ topics, initial }: { topics: { id: string; name: string; status: GapStatus }[]; initial: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [perTopic, setPerTopic] = useState(2);
  const [state, setState] = useState<{ busy: boolean; error?: string; retryable?: boolean }>({ busy: false });
  const key = useMemo(() => crypto.randomUUID(), []); // one key per quiz request: double-clicks can't create two quizzes
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 8) n.add(id); return n; });
  const start = async () => {
    setState({ busy: true });
    try {
      const r = await api<{ sessionId: string }>("/api/quiz", { method: "POST", json: { topicIds: [...selected], questionsPerTopic: perTopic, idempotencyKey: key } });
      router.push(`/quiz/${r.sessionId}`);
    } catch (e) {
      const err = e instanceof ClientApiError ? e : null;
      setState({ busy: false, error: err?.message ?? "Could not create the quiz.", retryable: err?.retryable });
    }
  };
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">Topics to test (up to 8)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {topics.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 ${selected.has(t.id) ? "border-accent bg-accent-tint/50" : "border-line bg-surface"}`}>
              <span className="flex items-center gap-3"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-accent" />{t.name}</span>
              <StatusBadge status={t.status} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="per" className="label">Questions per topic</label>
          <select id="per" className="field w-28" value={perTopic} onChange={(e) => setPerTopic(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
        </div>
        <Button size="lg" onClick={start} busy={state.busy} disabled={selected.size === 0}>
          {state.busy ? "Writing questions from your materials…" : `Start quiz (${selected.size * perTopic} questions max)`}
        </Button>
      </div>
      {state.busy && <p className="text-sm text-ink-soft" aria-live="polite">Each question is checked against its source passage. Ones that fail the check are dropped. This takes 10–40 seconds.</p>}
      {state.error && <p role="alert" className="text-sm text-weak">{state.error} {state.retryable && <button className="font-medium underline" onClick={start}>Retry</button>}</p>}
    </div>
  );
}
