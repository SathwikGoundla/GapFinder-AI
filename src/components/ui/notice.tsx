import { cn } from "@/lib/utils";

export function Notice({ tone = "info", title, children, action, className }: {
  tone?: "info" | "error" | "success" | "warning"; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  const tones = {
    info: "border-accent/30 bg-accent-tint", error: "border-weak/30 bg-weak-tint",
    success: "border-strong/30 bg-strong-tint", warning: "border-developing/30 bg-developing-tint",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between", tones[tone], className)}>
      <div>
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-ink-soft">{children}</div>}
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl leading-tight sm:text-[2.1rem]">{title}</h1>
        {description && <p className="prose-measure mt-2 text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}
