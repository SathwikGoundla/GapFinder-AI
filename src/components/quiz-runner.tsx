"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";

export interface ClientQuestion { id: string; type: "mcq" | "short"; prompt: string; options: string[] | null; difficulty: string; topic: string }
type Answers = Record<string, { selectedOption: number | null; response: string | null }>;

export function QuizRunner({ sessionId, questions }: { sessionId: string; questions: ClientQuestion[] }) {
  const storageKey = `gapfinder-quiz-${sessionId}`;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  useEffect(() => { try { const s = sessionStorage.getItem(storageKey); if (s) setAnswers(JSON.parse(s) as Answers); } catch { /* draft restore is best effort */ } }, [storageKey]);
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(answers)); } catch { /* ignore */ } }, [answers, storageKey]);

  const q = questions[i]!;
  const a = answers[q.id];
  const answered = (id: string) => { const x = answers[id]; return x != null && (x.selectedOption != null || (x.response ?? "").trim().length > 0); };
  const done = questions.filter((x) => answered(x.id)).length;
  const set = (v: Partial<Answers[string]>) => setAnswers((s) => ({ ...s, [q.id]: { selectedOption: null, response: null, ...s[q.id], ...v } }));

  const submit = async () => {
    const blank = questions.length - done;
    if (blank > 0 && !window.confirm(`${blank} question${blank === 1 ? " is" : "s are"} unanswered. Blank answers count as not known. Submit anyway?`)) return;
    setState({ busy: true });
    try {
      await api(`/api/quiz/${sessionId}/submit`, { method: "POST", json: { answers: questions.map((x) => ({ questionId: x.id, ...(answers[x.id] ?? { selectedOption: null, response: null }) })) } });
      try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
      // Full navigation: router.refresh() could lose this update when the runner is replaced by results (verified in audit).
      window.location.assign(`/quiz/${sessionId}`);
    } catch (e) {
      setState({ busy: false, error: e instanceof ClientApiError ? `${e.message} Your answers are saved on this device.` : "Submission failed." });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>Question {i + 1} of {questions.length}</span><span>{done} answered</span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {questions.map((x, n) => <button key={x.id} tabIndex={-1} onClick={() => setI(n)} className={`h-1.5 flex-1 rounded-full ${n === i ? "bg-accent" : answered(x.id) ? "bg-ink-faint" : "bg-line"}`} />)}
        </div>
      </div>
      <article className="panel p-6 sm:p-8" aria-labelledby="qprompt">
        <p className="text-sm text-ink-faint">{q.topic} · {q.difficulty} · {q.type === "mcq" ? "Choose one" : "Short answer"}</p>
        <h2 id="qprompt" className="mt-2 font-display text-xl leading-snug sm:text-2xl">{q.prompt}</h2>
        {q.type === "mcq" && q.options ? (
          <fieldset className="mt-6 space-y-2">
            <legend className="sr-only">Options</legend>
            {q.options.map((opt, n) => (
              <label key={n} className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 ${a?.selectedOption === n ? "border-accent bg-accent-tint/60" : "border-line hover:border-ink-faint"}`}>
                <input type="radio" name={`q-${q.id}`} checked={a?.selectedOption === n} onChange={() => set({ selectedOption: n })} className="mt-1 accent-accent" />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="mt-6">
            <label htmlFor={`r-${q.id}`} className="label">Your answer</label>
            <textarea id={`r-${q.id}`} rows={5} maxLength={2000} className="field" value={a?.response ?? ""} onChange={(e) => set({ response: e.target.value })}
              placeholder="Explain in your own words. Wording doesn't need to match your notes." />
          </div>
        )}
      </article>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>Previous</Button>
        {i < questions.length - 1
          ? <Button onClick={() => setI((n) => n + 1)}>Next question</Button>
          : <Button onClick={submit} busy={state.busy}>{state.busy ? "Checking your answers…" : "Submit quiz"}</Button>}
      </div>
      {state.error && <p role="alert" className="text-sm text-weak">{state.error} <button className="font-medium underline" onClick={submit}>Retry</button></p>}
    </div>
  );
}
