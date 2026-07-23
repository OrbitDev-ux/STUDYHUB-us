import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDirectChat } from "../actions";
import { DirectChat } from "@/components/messages/direct-chat";

export default async function DirectMessagePage({ params }: { params: Promise<{ id: string }> }) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { id } = await params; const result = await getDirectChat(id); if (!result.chat) notFound(); return <DirectChat initial={result.chat} myUserId={user.id} />; }
