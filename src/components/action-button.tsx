"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonProps } from "./ui/button";
import { api, ClientApiError } from "@/lib/client-api";

/** Calls an API endpoint, then refreshes server data. Shows the server's error message and a retry option. */
export function ActionButton({ url, method = "POST", body, confirm, pendingLabel, successMessage, redirectTo, children, ...props }: ButtonProps & {
  url: string; method?: string; body?: unknown; confirm?: string; pendingLabel?: string; successMessage?: string;
  redirectTo?: (data: unknown) => string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [done, setDone] = useState(false);
  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true); setError(null); setDone(false);
    try {
      const data = await api<unknown>(url, { method, json: body ?? {} });
      const to = redirectTo?.(data);
      if (to) router.push(to); else { setDone(true); router.refresh(); }
    } catch (e) {
      setError(e instanceof ClientApiError ? e : new ClientApiError("Something went wrong.", "UNKNOWN", true));
    } finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col items-start gap-2">
      <Button {...props} busy={busy} onClick={run}>{busy && pendingLabel ? pendingLabel : children}</Button>
      {done && successMessage && <span role="status" className="text-sm text-strong">{successMessage}</span>}
      {error && (
        <span role="alert" className="max-w-sm text-sm text-weak">
          {error.message}{" "}
          {error.retryable && <button className="font-medium underline underline-offset-2" onClick={run}>Retry</button>}
        </span>
      )}
    </span>
  );
}
