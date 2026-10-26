export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-9 w-64 animate-pulse rounded bg-line" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-line/70" />
      <div className="mt-8 h-40 animate-pulse rounded-lg bg-line/50" />
    </div>
  );
}
