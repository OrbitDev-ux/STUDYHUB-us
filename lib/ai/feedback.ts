import { callAIForJSON } from "./client";

interface FeedbackInput {
  nickname: string;
  studyMinutes: number;
  targetMinutes: number;
  homeworkCompletionRate: number;
  correctRate: number;
  improvedUnits: string[];
  weakUnits: string[];
  streakDays: number;
}

export interface GeneratedFeedback {
  goal_achievement_rate: number;
  recommended_next: string;
  ai_message: string;
}

/** 하루를 마무리하는 AI 피드백 생성 */
export async function generateDailyFeedback(input: FeedbackInput): Promise<GeneratedFeedback> {
  return callAIForJSON<GeneratedFeedback>({
    system:
      "당신은 학생을 매일 격려하고 코칭하는 AI 과외 선생님입니다. 사실에 기반해 구체적으로 칭찬하고, 다음 학습 방향을 명확히 제안합니다. 과장 없이 따뜻한 어투를 사용합니다.",
    prompt: `학생: ${input.nickname}
오늘 공부 시간: ${input.studyMinutes}분 (목표: ${input.targetMinutes}분)
숙제 완료율: ${input.homeworkCompletionRate}%
정답률: ${input.correctRate}%
향상된 단원: ${JSON.stringify(input.improvedUnits)}
남은 취약 단원: ${JSON.stringify(input.weakUnits)}
연속 학습일: ${input.streakDays}일

아래 JSON 스키마로 일일 피드백을 작성하세요.
{
  "goal_achievement_rate": 숫자(%, 소수점 가능),
  "recommended_next": "내일 우선적으로 복습할 내용 한 문장",
  "ai_message": "3~4문장의 피드백 메시지. '오늘 OO분 공부했습니다. 목표 달성률 OO%.' 형식으로 시작하고, 향상된 점과 내일 추천사항을 자연스럽게 포함"
}`,
    maxTokens: 800,
    fallback: () => {
      const rate = Math.round((input.studyMinutes / Math.max(input.targetMinutes, 1)) * 100);
      const nextUnit = input.weakUnits[0] ?? "오늘 틀린 문제";
      return {
        goal_achievement_rate: rate,
        recommended_next: `내일은 ${nextUnit}을(를) 가장 먼저 복습해보세요.`,
        ai_message: `오늘 ${input.studyMinutes}분 공부했습니다. 목표 달성률은 ${rate}%입니다. 숙제 완료율은 ${input.homeworkCompletionRate}%, 정답률은 ${input.correctRate}%였어요. 오늘의 흐름을 이어 내일도 한 단계씩 꾸준히 학습해보세요.`,
      };
    },
  });
}
