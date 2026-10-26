import { NextResponse } from "next/server";
import { toErrorBody } from "./errors";

/** Wraps a route handler so every failure becomes a safe JSON error with a retry hint. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return NextResponse.json({ data });
    } catch (err) {
      const { status, body } = toErrorBody(err);
      return NextResponse.json(body, { status });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return null; }
}
