import { callAIForJSON } from "./client";
import type { SubjectId } from "@/types";

export interface GeneratedPlanItem {
  subject_id: SubjectId;
  unit_name: string | null;
  title: string;
  planned_minutes: number;
  priority: 1 | 2 | 3;
  type: "new" | "review";
}

interface PlannerInput {
  gradeLevel: string;
  examDate: string | null;
  targetMinutes: number;
  weakUnitsBySubject: { subject: SubjectId; units: string[] }[];
  yesterdayIncomplete: string[];
}

/** 매일 학습 플래너(오늘 할 일, 시간, 우선순위, 복습계획) 생성 */
export async function generateDailyStudyPlan(
  input: PlannerInput
): Promise<{ summary: string; items: GeneratedPlanItem[] }> {
  const daysUntilExam = input.examDate
    ? Math.max(0, Math.ceil((new Date(input.examDate).getTime() - Date.now()) / 86400000))
    : null;

  return callAIForJSON<{ summary: string; items: GeneratedPlanItem[] }>({
    system:
      "당신은 학생의 시험 일정과 취약점을 고려해 하루 학습 계획을 세워주는 AI 학습 플래너입니다. 현실적인 시간 배분과 명확한 우선순위를 제시합니다.",
    prompt: `학년: ${input.gradeLevel}
목표 학습시간: ${input.targetMinutes}분
시험까지 남은 일수: ${daysUntilExam ?? "미설정"}
과목별 취약 단원: ${JSON.stringify(input.weakUnitsBySubject)}
어제 못 끝낸 항목: ${JSON.stringify(input.yesterdayIncomplete)}

오늘의 학습 계획을 아래 JSON 스키마로 생성하세요. planned_minutes 총합이 목표 학습시간과 비슷하도록 배분하고, priority 1(가장 중요)~3(여유 있으면)을 부여하세요.
{
  "summary": "오늘 계획에 대한 2문장 요약 (우선순위와 이유 포함)",
  "items": [
    {
      "subject_id": "math",
      "unit_name": "분수",
      "title": "분수 개념 복습 및 연산 문제풀이",
      "planned_minutes": 25,
      "priority": 1,
      "type": "review"
    }
  ]
}`,
    maxTokens: 2000,
  });
}
