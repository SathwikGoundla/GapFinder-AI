"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";

export function PlanForm({ examDate, dailyMinutes, label }: { examDate?: string; dailyMinutes?: number; label: string }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [date, setDate] = useState(examDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [mins, setMins] = useState(dailyMinutes ?? 60);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    try {
      await api("/api/plan", { method: "POST", json: { examDate: date, dailyMinutes: mins, today: new Date().toISOString().slice(0, 10) } });
      // Full navigation: router.refresh() lost this update when the form itself is replaced (verified in audit).
      window.location.assign("/plan");
    } catch (err) { setState({ busy: false, error: err instanceof ClientApiError ? err.message : "Could not create the plan." }); }
  };
  return (
    <form onSubmit={submit} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
      <div><label htmlFor="exam" className="label">Exam date</label><input id="exam" type="date" min={tomorrow} required className="field" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label htmlFor="mins" className="label">Study time per day (minutes)</label><input id="mins" type="number" min={15} max={600} step={5} required className="field sm:w-40" value={mins} onChange={(e) => setMins(Number(e.target.value))} /></div>
      <Button type="submit" busy={state.busy}>{state.busy ? "Building plan…" : label}</Button>
      {state.error && <p role="alert" className="text-sm text-weak sm:self-center">{state.error}</p>}
    </form>
  );
}

export function SessionToggle({ id, completed }: { id: string; completed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const toggle = async () => {
    setBusy(true); setError(false);
    try { await api(`/api/plan/sessions/${id}`, { method: "PATCH", json: { completed: !completed } }); router.refresh(); }
    catch { setError(true); } finally { setBusy(false); }
  };
  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant={completed ? "ghost" : "secondary"} busy={busy} onClick={toggle} aria-pressed={completed}>{completed ? "Done ✓ (undo)" : "Mark done"}</Button>
      {error && <span role="alert" className="text-xs text-weak">Not saved — try again</span>}
    </span>
  );
}
