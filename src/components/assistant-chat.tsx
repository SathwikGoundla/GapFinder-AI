"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";
import { formatSource } from "@/lib/types";

interface Reply { supported: boolean; answer: string; inference: string | null; droppedClaims: number; claims: { text: string; quote: string; source: { title: string; page: number | null; section: string | null } }[] }
type Turn = { q: string; r?: Reply; error?: string };

export function AssistantChat({ topics, initialTopic }: { topics: { id: string; name: string }[]; initialTopic: string | null }) {
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [q, setQ] = useState(initialTopic ? `Explain ${topics.find((t) => t.id === initialTopic)?.name ?? "this topic"} simply.` : "");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = async (question: string) => {
    if (question.trim().length < 3) return;
    setBusy(true);
    setTurns((t) => [...t, { q: question }]);
    try {
      const r = await api<Reply>("/api/assistant", { method: "POST", json: { question, topicId: topic || null } });
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r } : x)));
      setQ("");
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: e instanceof ClientApiError ? e.message : "Request failed." } : x)));
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <ol className="space-y-6" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i}>
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-ink px-4 py-2 text-white">{t.q}</p>
            {!t.r && !t.error && <p className="mt-3 text-sm text-ink-soft">Searching your materials…</p>}
            {t.error && <p role="alert" className="mt-3 text-sm text-weak">{t.error} <button className="underline" onClick={() => ask(t.q)}>Retry</button></p>}
            {t.r && (
              <div className={`panel mt-3 p-5 ${t.r.supported ? "" : "border-dashed"}`}>
                {!t.r.supported && <p className="mb-2 text-sm font-medium text-unknown">Not found in your materials</p>}
                <p className="prose-measure whitespace-pre-line">{t.r.answer}</p>
                {t.r.claims.length > 0 && (
                  <ol className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                    {t.r.claims.map((c, k) => (
                      <li key={k}><span className="text-ink-faint">[{k + 1}]</span> &ldquo;{c.quote}&rdquo; <span className="text-xs text-ink-faint">— {formatSource(c.source)}</span></li>
                    ))}
                  </ol>
                )}
                {t.r.inference && <p className="mt-3 rounded bg-developing-tint px-3 py-2 text-sm"><span className="font-medium">Inference (not stated in your notes):</span> {t.r.inference}</p>}
                {t.r.droppedClaims > 0 && <p className="mt-2 text-xs text-ink-faint">{t.r.droppedClaims} statement(s) removed because their quote could not be found in your materials.</p>}
              </div>
            )}
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="panel space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="topic">Topic</label>
          <select id="topic" className="field sm:w-56" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Any topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="q">Question</label>
          <input id="q" className="field flex-1" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder="Ask about something in your materials" />
          <Button type="submit" busy={busy}>Ask</Button>
        </div>
        <p className="text-xs text-ink-faint">Answers use only your uploaded materials. Every quote is checked against the source before it is shown.</p>
      </form>
    </div>
  );
}
