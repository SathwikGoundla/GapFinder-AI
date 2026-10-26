"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";

export function TopicEditor({ id, name, parents, parentId }: { id: string; name: string; parentId: string | null; parents: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [parent, setParent] = useState(parentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api(`/api/topics/${id}`, { method: "PATCH", json: { name: value, parentId: parent || null } });
      setEditing(false); router.refresh();
    } catch (e) { setError(e instanceof ClientApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${name}" and its quiz history? This cannot be undone.`)) return;
    setBusy(true);
    try { await api(`/api/topics/${id}`, { method: "DELETE" }); router.refresh(); }
    catch (e) { setError(e instanceof ClientApiError ? e.message : "Could not delete."); setBusy(false); }
  };
  if (!editing) return (
    <span className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${name}`}>Edit</Button>
      <Button size="sm" variant="ghost" onClick={remove} busy={busy} aria-label={`Delete ${name}`} className="text-weak">Delete</Button>
      {error && <span role="alert" className="text-sm text-weak">{error}</span>}
    </span>
  );
  return (
    <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1"><label className="label" htmlFor={`n-${id}`}>Name</label><input id={`n-${id}`} className="field" value={value} maxLength={160} onChange={(e) => setValue(e.target.value)} /></div>
      <div className="sm:w-56"><label className="label" htmlFor={`p-${id}`}>Belongs under</label>
        <select id={`p-${id}`} className="field" value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">— Top level —</option>
          {parents.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Button size="md" onClick={save} busy={busy}>Save</Button>
      <Button size="md" variant="ghost" onClick={() => { setEditing(false); setValue(name); }}>Cancel</Button>
      {error && <p role="alert" className="text-sm text-weak">{error}</p>}
    </div>
  );
}
