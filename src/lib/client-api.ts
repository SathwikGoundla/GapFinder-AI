export class ClientApiError extends Error {
  constructor(message: string, readonly code: string, readonly retryable: boolean) { super(message); }
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ClientApiError("Network error — check your connection and try again.", "NETWORK", true);
  }
  const body = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; retryable: boolean } } | null;
  if (!res.ok || !body || body.error) {
    if (res.status === 401) window.location.href = "/login?expired=1";
    throw new ClientApiError(body?.error?.message ?? `Request failed (${res.status}).`, body?.error?.code ?? "HTTP", body?.error?.retryable ?? res.status >= 500);
  }
  return body.data as T;
}
