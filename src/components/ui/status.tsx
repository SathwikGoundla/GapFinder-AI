import { cn } from "@/lib/utils";
import type { GapStatus, Confidence } from "@/lib/scoring/gap";

export const STATUS_META: Record<GapStatus, { label: string; text: string; bg: string; dot: string; border: string }> = {
  weak:         { label: "Weak",          text: "text-weak",       bg: "bg-weak-tint",       dot: "bg-weak",       border: "border-weak" },
  developing:   { label: "Developing",    text: "text-developing", bg: "bg-developing-tint", dot: "bg-developing", border: "border-developing" },
  strong:       { label: "Strong",        text: "text-strong",     bg: "bg-strong-tint",     dot: "bg-strong",     border: "border-strong" },
  insufficient: { label: "Not enough evidence", text: "text-unknown", bg: "bg-unknown-tint", dot: "bg-unknown",    border: "border-unknown border-dashed" },
};

export function StatusBadge({ status, className }: { status: GapStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", m.bg, m.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

export function ConfidenceNote({ confidence, answers }: { confidence: Confidence; answers: number }) {
  const text = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" }[confidence];
  return <span className="text-xs text-ink-faint">{text} · based on {answers} answer{answers === 1 ? "" : "s"}</span>;
}

/** The signature element: one mark per scored answer, newest first. */
export function EvidenceStrip({ verdicts, label }: { verdicts: ("correct" | "partial" | "incorrect" | "unanswered" | "ambiguous")[]; label: string }) {
  const style = {
    correct: "bg-strong", partial: "bg-developing", incorrect: "bg-weak",
    unanswered: "border border-weak bg-surface", ambiguous: "border border-dashed border-unknown bg-surface",
  } as const;
  if (verdicts.length === 0) return <span className="text-xs text-ink-faint">No answers yet</span>;
  return (
    <span className="flex max-w-[15rem] shrink-0 flex-wrap justify-end gap-1" role="img" aria-label={label}>
      {verdicts.slice(0, 18).map((v, i) => <span key={i} className={cn("h-3 w-3 rounded-[2px]", style[v])} title={v} />)}
    </span>
  );
}
