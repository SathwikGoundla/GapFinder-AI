"use client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <Notice tone="error" title="This page could not load" action={<Button onClick={reset} variant="secondary">Try again</Button>}>
    The database or a service may be temporarily unavailable. Your saved work is not affected.
  </Notice>;
}
