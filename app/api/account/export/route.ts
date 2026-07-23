import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [profile, settings, diagnostics, subjectStats, homeworks, plans, sessions, wrongAnswers, feedback, badges, xp, notifications, practiceAttempts, battleRating, battleMatches, battleAnswers, ratingHistory, contestEntries, contestAnswers, forumPosts, forumComments, forumLikes, directThreads, userBlocks] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase.from("diagnostic_results").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("user_subject_stats").select("*").eq("user_id", user.id),
    supabase.from("homeworks").select("*, homework_items(*)").eq("user_id", user.id).order("date"),
    supabase.from("study_plans").select("*, study_plan_items(*)").eq("user_id", user.id).order("date"),
    supabase.from("study_sessions").select("*").eq("user_id", user.id).order("started_at"),
    supabase.from("wrong_answers").select("*").eq("user_id", user.id).order("last_wrong_at"),
    supabase.from("daily_feedback").select("*").eq("user_id", user.id).order("date"),
    supabase.from("user_badges").select("*, badges(*)").eq("user_id", user.id).order("earned_at"),
    supabase.from("xp_transactions").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("practice_attempts").select("*").eq("user_id", user.id).order("attempted_at"),
    supabase.from("battle_ratings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("battle_matches").select("*").or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`).order("created_at"),
    supabase.from("battle_answers").select("*").eq("user_id", user.id).order("answered_at"),
    supabase.from("battle_rating_history").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("contest_entries").select("*, contests(title, starts_at, ends_at)").eq("user_id", user.id).order("started_at"),
    supabase.from("contest_answers").select("*").eq("user_id", user.id).order("answered_at"),
    supabase.from("forum_posts").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("forum_comments").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("forum_likes").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("direct_threads").select("*, direct_messages(*)").order("updated_at"),
    supabase.from("user_blocks").select("*").eq("blocker_id", user.id).order("created_at"),
  ]);

  const exportedAt = new Date().toISOString();
  const body = {
    format: "studyhub-account-export-v1",
    exportedAt,
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data,
    settings: settings.data,
    diagnostics: diagnostics.data ?? [], subjectStats: subjectStats.data ?? [],
    homeworks: homeworks.data ?? [], plans: plans.data ?? [], sessions: sessions.data ?? [],
    wrongAnswers: wrongAnswers.data ?? [], feedback: feedback.data ?? [], badges: badges.data ?? [],
    xpTransactions: xp.data ?? [], notifications: notifications.data ?? [],
    practiceAttempts: practiceAttempts.data ?? [],
    battleRating: battleRating.data,
    battleMatches: battleMatches.data ?? [], battleAnswers: battleAnswers.data ?? [],
    battleRatingHistory: ratingHistory.data ?? [],
    contestEntries: contestEntries.data ?? [], contestAnswers: contestAnswers.data ?? [],
    forumPosts: forumPosts.data ?? [], forumComments: forumComments.data ?? [], forumLikes: forumLikes.data ?? [],
    directThreads: directThreads.data ?? [], userBlocks: userBlocks.data ?? [],
  };
  const date = exportedAt.slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="studyhub-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
