import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { judgeOutputsMatch } from "@/lib/online-judge/output";
import type { JudgeRunResult } from "@/lib/online-judge/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return responseError("허용되지 않은 요청입니다.", 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return responseError("로그인이 필요합니다.", 401);
  if (await isRateLimited(`oj-submit:${user.id}`, 20, 60_000)) {
    return responseError("답안 제출이 너무 빠릅니다. 잠시 후 다시 시도해주세요.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return responseError("제출 형식이 올바르지 않습니다.", 400);
  }
  const payload = body as { problemId?: unknown; submittedOutput?: unknown };
  const problemId = typeof payload.problemId === "string" ? payload.problemId : "";
  const submittedOutput = typeof payload.submittedOutput === "string" ? payload.submittedOutput : "";
  if (!UUID.test(problemId) || !submittedOutput.trim() || submittedOutput.length > 50_000) {
    return responseError("문제 또는 출력 답안을 확인해주세요.", 400);
  }

  const [{ data: profile }, { data: problem, error: problemError }] = await Promise.all([
    supabase.from("profiles").select("is_banned,banned_until").eq("id", user.id).single(),
    supabase.from("oj_problems").select("id,title,status").eq("id", problemId).eq("status", "published").single(),
  ]);
  if (isCurrentlyBanned(profile)) return responseError("이용 정지된 계정은 답안을 제출할 수 없습니다.", 403);
  if (problemError || !problem) return responseError("공개된 문제를 찾을 수 없습니다.", 404);

  const admin = createAdminClient();
  const { data: fixedCase, error: caseError } = await admin.from("oj_test_cases")
    .select("expected_output,order_index")
    .eq("problem_id", problem.id)
    .order("order_index")
    .limit(1)
    .maybeSingle();
  if (caseError || !fixedCase) return responseError("이 문제의 고정 입력과 정답이 준비되지 않았습니다.", 503);

  const accepted = judgeOutputsMatch(submittedOutput, fixedCase.expected_output);
  const result: JudgeRunResult = {
    verdict: accepted ? "accepted" : "wrong_answer",
    passedCount: accepted ? 1 : 0,
    testCount: 1,
    score: accepted ? 100 : 0,
    maxTimeMs: null,
    maxMemoryKb: null,
    compileOutput: null,
    cases: [{
      orderIndex: fixedCase.order_index,
      verdict: accepted ? "accepted" : "wrong_answer",
      timeMs: null,
      memoryKb: null,
      message: null,
    }],
  };

  const { data: submission, error: createError } = await admin.from("oj_submissions").insert({
    user_id: user.id,
    problem_id: problem.id,
    language: null,
    source_code: null,
    submitted_output: submittedOutput,
    verdict: "judging",
    test_count: 1,
  }).select("id").single();
  if (createError || !submission) {
    console.error("[output-judge] submission create failed:", createError?.message);
    return responseError("답안 제출 기록을 만들지 못했습니다. `0030_output_only_judge.sql` 적용 여부를 확인해주세요.", 500);
  }

  const { error: resultError } = await admin.from("oj_submission_cases").insert({
    submission_id: submission.id,
    order_index: fixedCase.order_index,
    verdict: result.verdict,
    time_ms: null,
    memory_kb: null,
    message: null,
  });
  if (resultError) console.error("[output-judge] result save failed:", resultError.message);

  const { data: completed, error: completionError } = await admin.rpc("complete_oj_submission", {
    p_submission_id: submission.id,
    p_verdict: result.verdict,
    p_score: result.score,
    p_passed_count: result.passedCount,
    p_test_count: 1,
    p_max_time_ms: null,
    p_max_memory_kb: null,
    p_compile_output: null,
    p_error_message: null,
  });
  if (completionError || completed !== true) {
    console.error("[output-judge] completion failed:", completionError?.message);
    return responseError("판정 결과를 저장하지 못했습니다.", 500, submission.id);
  }
  return NextResponse.json({ submissionId: submission.id, result });
}

function isCurrentlyBanned(profile: { is_banned?: boolean; banned_until?: string | null } | null) {
  return Boolean(profile?.is_banned && (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now()));
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function responseError(error: string, status: number, submissionId?: string) {
  return NextResponse.json({ error, ...(submissionId ? { submissionId } : {}) }, { status });
}
