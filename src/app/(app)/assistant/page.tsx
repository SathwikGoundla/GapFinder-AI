import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/assistant-chat";
import { PageHeader } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Ask your notes" };

export default async function Assistant({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("topics").select("id,name").order("position");
  const topics = (data ?? []) as { id: string; name: string }[];
  return (
    <>
      <PageHeader title="Ask your notes" description="Get an explanation built from your own materials, with the exact passages it came from. If your notes don't cover it, you'll be told." />
      <AssistantChat topics={topics} initialTopic={topics.some((t) => t.id === sp.topic) ? sp.topic! : null} />
    </>
  );
}
