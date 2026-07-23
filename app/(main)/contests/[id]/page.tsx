import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContestState } from "../actions";
import { ContestArena } from "@/components/contests/contest-arena";
import { Badge } from "@/components/ui/badge";

export default async function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { id } = await params; const result = await getContestState(id); if (!result.state) notFound(); const state = result.state;
  return <div className="flex flex-col gap-6"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{state.title}</h1><Badge variant="secondary">{state.gradeLevel}</Badge><Badge variant="outline">{state.subjectId}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{state.description}</p></div><ContestArena initial={state} /></div>;
}
