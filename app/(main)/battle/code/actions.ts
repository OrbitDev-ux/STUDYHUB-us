"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isGradeLevel } from "@/lib/practice/question-bank";
import { judgeOutputsMatch } from "@/lib/online-judge/output";

const UUID = /^[0-9a-f-]{36}$/i;

type CodingMatchRow = {
  id: string;
  status: "waiting" | "active" | "completed" | "cancelled";
  grade_level: string;
  problem_id: string;
  player1_id: string;
  player2_id: string | null;
  player1_correct: boolean | null;
  player2_correct: boolean | null;
  player1_response_ms: number | null;
  player2_response_ms: number | null;
  player1_submitted_at: string | null;
  player2_submitted_at: string | null;
  player1_rating_before: number | null;
  player2_rating_before: number | null;
  player1_rating_after: number | null;
  player2_rating_after: number | null;
  winner_id: string | null;
  expires_at: string;
};

export type CodingBattleState = {
  id: string;
  status: CodingMatchRow["status"];
  gradeLevel: string;
  problem: {
    id: string;
    title: string;
    statement: string;
    inputDescription: string;
    outputDescription: string;
    constraints: string;
    difficulty: number;
    fixedInput: string;
  } | null;
  submitted: boolean;
  correct: boolean | null;
  responseMs: number | null;
  opponentSubmitted: boolean;
  opponentCorrect: boolean | null;
  opponentResponseMs: number | null;
  myRatingBefore: number;
  myRatingAfter: number | null;
  opponentRatingBefore: number | null;
  opponent: { id: string; nickname: string; avatarUrl: string | null } | null;
  winner: "me" | "opponent" | "draw" | null;
  expiresAt: string;
};

export async function joinCodingBattle(): Promise<{ matchId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data: profile } = await supabase.from("profiles")
    .select("grade_level").eq("id", user.id).single();
  if (!isGradeLevel(profile?.grade_level ?? "")) {
    return { error: "프로필에서 학년을 먼저 설정해주세요." };
  }
  const { data, error } = await supabase.rpc("join_coding_battle_queue", {
    p_grade_level: profile!.grade_level,
  });
  if (error) {
    if (/no published judge problem/i.test(error.message)) {
      return { error: "이 학년에서 배틀에 사용할 공개 고정 Input 문제가 없습니다." };
    }
    if (/schema cache|could not find|does not exist/i.test(error.message)) {
      return { error: "코딩 배틀 DB 업데이트가 필요합니다. 관리자에게 문의해주세요." };
    }
    return { error: `코딩 배틀 매칭 실패: ${error.message}` };
  }
  return { matchId: data?.[0]?.match_id };
}

export async function getCodingBattleState(
  matchId: string,
): Promise<{ state?: CodingBattleState; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!UUID.test(matchId)) return { error: "잘못된 코딩 배틀입니다." };

  await supabase.rpc("finalize_coding_battle", { p_match_id: matchId });
  const { data, error } = await supabase.from("coding_battle_matches")
    .select("*").eq("id", matchId).single();
  const match = data as CodingMatchRow | null;
  if (error || !match || ![match.player1_id, match.player2_id].includes(user.id)) {
    return { error: "참가한 코딩 배틀을 찾을 수 없습니다." };
  }
  if (match.status === "waiting" && new Date(match.expires_at).getTime() <= Date.now()) {
    await supabase.rpc("cancel_waiting_coding_battle", { p_match_id: matchId });
    match.status = "cancelled";
  }

  const isPlayer1 = match.player1_id === user.id;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
  const admin = createAdminClient();
  const revealProblem = match.status === "active" || match.status === "completed";
  const [{ data: problem }, { data: fixedCase }, opponentResult] = await Promise.all([
    revealProblem ? admin.from("oj_problems")
      .select("id,title,statement,input_description,output_description,constraints_text,difficulty")
      .eq("id", match.problem_id).single() : Promise.resolve({ data: null }),
    revealProblem ? admin.from("oj_test_cases").select("input")
      .eq("problem_id", match.problem_id).eq("order_index", 0).single() : Promise.resolve({ data: null }),
    opponentId
      ? admin.from("profiles").select("nickname,avatar_url").eq("id", opponentId).single()
      : Promise.resolve({ data: null }),
  ]);
  if (revealProblem && (!problem || !fixedCase)) {
    return { error: "배틀 문제의 고정 Input을 불러오지 못했습니다." };
  }

  const submitted = isPlayer1 ? Boolean(match.player1_submitted_at) : Boolean(match.player2_submitted_at);
  const opponentSubmitted = isPlayer1 ? Boolean(match.player2_submitted_at) : Boolean(match.player1_submitted_at);
  const winner = match.status !== "completed" ? null
    : match.winner_id === null ? "draw"
      : match.winner_id === user.id ? "me" : "opponent";

  return { state: {
    id: match.id,
    status: match.status,
    gradeLevel: match.grade_level,
    problem: problem && fixedCase ? {
      id: problem.id,
      title: problem.title,
      statement: problem.statement,
      inputDescription: problem.input_description,
      outputDescription: problem.output_description,
      constraints: problem.constraints_text,
      difficulty: problem.difficulty,
      fixedInput: fixedCase.input,
    } : null,
    submitted,
    correct: submitted ? (isPlayer1 ? match.player1_correct : match.player2_correct) : null,
    responseMs: isPlayer1 ? match.player1_response_ms : match.player2_response_ms,
    opponentSubmitted,
    opponentCorrect: match.status === "completed"
      ? (isPlayer1 ? match.player2_correct : match.player1_correct)
      : null,
    opponentResponseMs: match.status === "completed"
      ? (isPlayer1 ? match.player2_response_ms : match.player1_response_ms)
      : null,
    myRatingBefore: (isPlayer1 ? match.player1_rating_before : match.player2_rating_before) ?? 1200,
    myRatingAfter: isPlayer1 ? match.player1_rating_after : match.player2_rating_after,
    opponentRatingBefore: isPlayer1 ? match.player2_rating_before : match.player1_rating_before,
    opponent: opponentResult.data && opponentId ? {
      id: opponentId,
      nickname: opponentResult.data.nickname,
      avatarUrl: opponentResult.data.avatar_url,
    } : null,
    winner,
    expiresAt: match.expires_at,
  } };
}

export async function submitCodingBattleOutput(
  matchId: string,
  submittedOutput: string,
  responseMs: number,
): Promise<{ verdict?: "accepted" | "wrong_answer"; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!UUID.test(matchId) || !submittedOutput.trim() || submittedOutput.length > 50_000) {
    return { error: "출력 답안을 확인해주세요." };
  }
  const { data } = await supabase.from("coding_battle_matches")
    .select("problem_id,status,player1_id,player2_id,player1_submitted_at,player2_submitted_at")
    .eq("id", matchId).single();
  if (!data || data.status !== "active" || ![data.player1_id, data.player2_id].includes(user.id)) {
    return { error: "현재 제출할 수 있는 코딩 배틀이 아닙니다." };
  }
  const alreadySubmitted = data.player1_id === user.id
    ? Boolean(data.player1_submitted_at)
    : Boolean(data.player2_submitted_at);
  if (alreadySubmitted) return { error: "이 배틀의 답안은 이미 제출했습니다." };

  const admin = createAdminClient();
  const { data: fixedCase } = await admin.from("oj_test_cases")
    .select("expected_output,order_index")
    .eq("problem_id", data.problem_id).eq("order_index", 0).single();
  if (!fixedCase) return { error: "서버 정답 데이터가 준비되지 않았습니다." };
  const accepted = judgeOutputsMatch(submittedOutput, fixedCase.expected_output);

  const { error } = await admin.rpc("record_coding_battle_output", {
    p_user_id: user.id,
    p_match_id: matchId,
    p_is_correct: accepted,
    p_response_ms: Math.min(900_000, Math.max(0, Math.round(responseMs))),
  });
  if (error) return { error: `답안을 제출하지 못했습니다: ${error.message}` };

  // A battle answer is also retained in the user's ordinary Judge history.
  const { data: submission } = await admin.from("oj_submissions").insert({
    user_id: user.id,
    problem_id: data.problem_id,
    language: null,
    source_code: null,
    submitted_output: submittedOutput,
    submission_mode: "output_only",
    verdict: "judging",
    test_count: 1,
  }).select("id").single();
  if (submission) {
    await admin.from("oj_submission_cases").insert({
      submission_id: submission.id,
      order_index: fixedCase.order_index,
      verdict: accepted ? "accepted" : "wrong_answer",
    });
    await admin.rpc("complete_oj_submission", {
      p_submission_id: submission.id,
      p_verdict: accepted ? "accepted" : "wrong_answer",
      p_score: accepted ? 100 : 0,
      p_passed_count: accepted ? 1 : 0,
      p_test_count: 1,
      p_max_time_ms: null,
      p_max_memory_kb: null,
      p_compile_output: null,
      p_error_message: null,
    });
  }
  return { verdict: accepted ? "accepted" : "wrong_answer" };
}

export async function cancelCodingBattle(matchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.rpc("cancel_waiting_coding_battle", { p_match_id: matchId });
  return error ? { error: error.message } : { ok: true };
}
