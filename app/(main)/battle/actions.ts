"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generatePracticeSet, getPracticeQuestion, isGradeLevel } from "@/lib/practice/question-bank";
import type { SubjectId } from "@/types";

const SUBJECTS: SubjectId[] = ["math", "english", "social", "science"];

export interface PublicBattleQuestion {
  key: string;
  unitName: string;
  difficulty: number;
  content: string;
  choices: string[];
}

export interface BattleState {
  id: string;
  status: "waiting" | "active" | "completed" | "cancelled";
  gradeLevel: string;
  subjectId: SubjectId;
  questions: PublicBattleQuestion[];
  myAnsweredKeys: string[];
  myScore: number;
  opponentScore: number;
  myRatingBefore: number;
  myRatingAfter: number | null;
  opponentRatingBefore: number | null;
  ratingBreakdown: {
    expectedRank: number;
    actualRank: number;
    performanceRating: number;
    baseDelta: number;
    correction: number;
    provisionalFactor: number;
  } | null;
  opponent: { id: string; nickname: string; avatarUrl: string | null } | null;
  winner: "me" | "opponent" | "draw" | null;
  expiresAt: string | null;
}

function isSubject(value: string): value is SubjectId {
  return SUBJECTS.includes(value as SubjectId);
}

function chooseQuestionKeys(grade: Parameters<typeof generatePracticeSet>[0], subject: SubjectId) {
  const pool = generatePracticeSet(grade, subject).map((question) => question.key);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, 5);
}

export async function joinBattle(subjectId: SubjectId): Promise<{ matchId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!isSubject(subjectId)) return { error: "지원하지 않는 과목입니다." };

  const { data: profile } = await supabase.from("profiles").select("grade_level").eq("id", user.id).single();
  if (!isGradeLevel(profile?.grade_level ?? "")) return { error: "프로필에서 학년을 먼저 설정해주세요." };

  const { data, error } = await supabase.rpc("join_battle_queue", {
    p_grade_level: profile!.grade_level,
    p_subject_id: subjectId,
    p_question_keys: chooseQuestionKeys(profile!.grade_level, subjectId),
  });
  if (error) return { error: `매칭을 시작하지 못했습니다: ${error.message}` };
  return { matchId: data?.[0]?.match_id };
}

export async function getBattleState(matchId: string): Promise<{ state?: BattleState; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return { error: "잘못된 배틀입니다." };

  // 양쪽이 모두 제출했거나 제한 시간이 지났다면 조회와 함께 한 번만 정산된다.
  await supabase.rpc("finalize_battle", { p_match_id: matchId });
  const { data: match, error } = await supabase.from("battle_matches").select("*").eq("id", matchId).single();
  if (error || !match) return { error: "배틀을 찾을 수 없습니다." };
  if (match.player1_id !== user.id && match.player2_id !== user.id) return { error: "참가한 배틀만 볼 수 있습니다." };
  if (match.status === "waiting" && match.expires_at && new Date(match.expires_at).getTime() <= Date.now()) {
    await supabase.rpc("cancel_waiting_battle", { p_match_id: matchId });
    match.status = "cancelled";
  }

  const isPlayer1 = match.player1_id === user.id;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
  const [{ data: ownAnswers }, opponentProfile] = await Promise.all([
    supabase.from("battle_answers").select("question_key").eq("match_id", matchId).eq("user_id", user.id),
    opponentId
      ? createAdminClient().from("profiles").select("nickname, avatar_url").eq("id", opponentId).single()
      : Promise.resolve({ data: null }),
  ]);

  const keys = Array.isArray(match.question_keys) ? match.question_keys as string[] : [];
  const questions = keys.map(getPracticeQuestion).filter(Boolean).map((question) => ({
    key: question!.key, unitName: question!.unitName, difficulty: question!.difficulty,
    content: question!.content, choices: question!.choices,
  }));
  const winner = match.status !== "completed" ? null
    : match.winner_id === null ? "draw"
      : match.winner_id === user.id ? "me" : "opponent";

  return { state: {
    id: match.id, status: match.status, gradeLevel: match.grade_level, subjectId: match.subject_id,
    questions, myAnsweredKeys: (ownAnswers ?? []).map((answer) => answer.question_key),
    myScore: isPlayer1 ? match.player1_score : match.player2_score,
    opponentScore: isPlayer1 ? match.player2_score : match.player1_score,
    myRatingBefore: (isPlayer1 ? match.player1_rating_before : match.player2_rating_before) ?? 1200,
    myRatingAfter: isPlayer1 ? match.player1_rating_after : match.player2_rating_after,
    opponentRatingBefore: isPlayer1 ? match.player2_rating_before : match.player1_rating_before,
    ratingBreakdown: match.status === "completed" ? {
      expectedRank: Number(isPlayer1 ? match.player1_expected_rank : match.player2_expected_rank) || 1.5,
      actualRank: Number(isPlayer1 ? match.player1_actual_rank : match.player2_actual_rank) || 1.5,
      performanceRating: Number(isPlayer1 ? match.player1_performance_rating : match.player2_performance_rating)
        || (isPlayer1 ? match.player1_rating_after : match.player2_rating_after)
        || 1200,
      baseDelta: Number(isPlayer1 ? match.player1_base_delta : match.player2_base_delta) || 0,
      correction: Number(isPlayer1 ? match.player1_correction : match.player2_correction) || 0,
      provisionalFactor: Number(isPlayer1 ? match.player1_provisional_factor : match.player2_provisional_factor) || 1,
    } : null,
    opponent: opponentProfile.data ? { id: opponentId!, nickname: opponentProfile.data.nickname, avatarUrl: opponentProfile.data.avatar_url } : null,
    winner, expiresAt: match.expires_at,
  } };
}

export async function submitBattleAnswer(
  matchId: string,
  questionKey: string,
  userAnswer: string,
  responseMs: number,
): Promise<{ correct?: boolean; answer?: string; explanation?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const question = getPracticeQuestion(questionKey);
  if (!question || !userAnswer || userAnswer.length > 500) return { error: "올바르지 않은 답안입니다." };

  const { data: match } = await supabase.from("battle_matches")
    .select("player1_id, player2_id, status, question_keys").eq("id", matchId).single();
  const keys = Array.isArray(match?.question_keys) ? match.question_keys as string[] : [];
  if (!match || match.status !== "active" || ![match.player1_id, match.player2_id].includes(user.id) || !keys.includes(questionKey)) {
    return { error: "진행 중인 배틀 문제가 아닙니다." };
  }

  const correct = userAnswer.trim() === question.answer;
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_battle_answer", {
    p_user_id: user.id, p_match_id: matchId, p_question_key: questionKey,
    p_user_answer: userAnswer.trim(), p_is_correct: correct,
    p_response_ms: Math.min(600000, Math.max(0, Math.round(responseMs))),
  });
  if (error) return { error: `답안을 제출하지 못했습니다: ${error.message}` };
  return { correct, answer: question.answer, explanation: question.explanation };
}

export async function cancelBattle(matchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.rpc("cancel_waiting_battle", { p_match_id: matchId });
  return error ? { error: error.message } : { ok: true };
}

export async function requestDirectBattle(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "") as SubjectId;
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || targetUserId === user.id || !isSubject(subjectId)) {
    redirect("/battle/play?challenge_error=invalid");
  }
  const { data: profile } = await supabase.from("profiles").select("grade_level").eq("id", user.id).single();
  if (!isGradeLevel(profile?.grade_level ?? "")) redirect("/battle/play?challenge_error=grade");

  const { error } = await supabase.rpc("create_battle_challenge", {
    p_target_user_id: targetUserId,
    p_grade_level: profile!.grade_level,
    p_subject_id: subjectId,
    p_question_keys: chooseQuestionKeys(profile!.grade_level, subjectId),
  });
  if (error) {
    console.error("[direct-battle] request failed:", error.message);
    if (/already exists|unique/i.test(error.message)) redirect("/battle/play?challenge_error=duplicate");
    if (/schema cache|could not find|does not exist/i.test(error.message)) redirect("/battle/play?challenge_error=migration");
    redirect("/battle/play?challenge_error=request_failed");
  }
  revalidatePath("/battle/play");
  redirect("/battle/play?challenge_requested=1");
}

export async function respondDirectBattle(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const challengeId = String(formData.get("challenge_id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !["accept", "decline", "cancel"].includes(action)) {
    redirect("/battle/play?challenge_error=invalid");
  }

  if (action === "accept") {
    const { data: matchId, error } = await supabase.rpc("accept_battle_challenge", {
      p_challenge_id: challengeId,
    });
    if (error || typeof matchId !== "string") {
      console.error("[direct-battle] accept failed:", error?.message);
      if (/active battle/i.test(error?.message ?? "")) redirect("/battle/play?challenge_error=active");
      if (/expired|no longer pending/i.test(error?.message ?? "")) redirect("/battle/play?challenge_error=expired");
      redirect("/battle/play?challenge_error=response_failed");
    }
    revalidatePath("/battle/play");
    redirect(`/battle/play?match=${matchId}`);
  }

  const { error } = await supabase.rpc("respond_battle_challenge", {
    p_challenge_id: challengeId,
    p_action: action,
  });
  if (error) {
    console.error("[direct-battle] response failed:", error.message);
    redirect("/battle/play?challenge_error=response_failed");
  }
  revalidatePath("/battle/play");
  redirect(`/battle/play?challenge_updated=${action}`);
}
