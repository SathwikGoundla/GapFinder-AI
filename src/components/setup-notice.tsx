export function SetupNotice() {
  return (
    <div className="panel p-6" role="alert">
      <h1 className="font-display text-xl">Setup needed</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Supabase is not configured, so sign-in and storage are unavailable. Copy <code>.env.example</code> to <code>.env.local</code>,
        add your Supabase URL and anon key, run the migration, and restart. Step-by-step instructions are in <code>RUN_INSTRUCTIONS.md</code>.
      </p>
    </div>
  );
}
