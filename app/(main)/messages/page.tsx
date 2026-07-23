import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listBlockedMessageUsers, listDirectThreads } from "./actions";
import { MessagesHub } from "@/components/messages/messages-hub";

export const metadata = { title: "메시지" };
export default async function MessagesPage() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const [threads, blocked] = await Promise.all([listDirectThreads(), listBlockedMessageUsers()]); return <div className="flex flex-col gap-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><MessagesSquare className="h-6 w-6 text-primary" /> 메시지</h1><p className="mt-1 text-sm text-muted-foreground">StudyHub 사용자와 안전하게 1:1로 대화하세요.</p></div><MessagesHub threads={threads} blocked={blocked} /></div>; }
