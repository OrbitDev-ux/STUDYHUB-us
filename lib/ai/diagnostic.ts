import { callAIForJSON } from "./client";
import type { SubjectId, WeakUnit, StrongUnit } from "@/types";

const SUBJECT_NAMES: Record<SubjectId, string> = {
  math: "수학",
  english: "영어",
  social: "사회",
  science: "과학",
};

export interface GeneratedQuestion {
  content: string;
  type: "multiple_choice" | "short_answer" | "ox";
  choices: string[] | null;
  answer: string;
  explanation: string;
  unit_name: string;
  difficulty: number;
}

/** 1. 진단평가 문항 생성. count는 호출부(fetchDiagnosticQuestions)에서 매번 20~30 사이로 무작위 지정한다. */
export async function generateDiagnosticQuestions(
  subject: SubjectId,
  gradeLevel: string,
  count = 20
): Promise<GeneratedQuestion[]> {
  const result = await callAIForJSON<{ questions: GeneratedQuestion[] }>({
    system:
      "당신은 한국 공교육 커리큘럼에 정통한 진단평가 출제 전문가입니다. 학생의 실력을 정확히 진단할 수 있도록 난이도가 고르게 분포된 문제를 출제합니다.",
    prompt: `학년: ${gradeLevel}
과목: ${SUBJECT_NAMES[subject]}
다음 JSON 스키마로 진단평가 문항 ${count}개를 생성하세요. 난이도(1~5)는 골고루 분포시키고, 여러 단원에 걸쳐 골고루 출제하세요 (같은 단원이 반복돼도 되지만 한두 단원에 몰리지 않게 하세요).
{
  "questions": [
    {
      "content": "문제 본문",
      "type": "multiple_choice",
      "choices": ["보기1","보기2","보기3","보기4"],
      "answer": "정답(보기 중 하나 그대로)",
      "explanation": "간단한 해설",
      "unit_name": "단원명 (예: 분수, 비와 비율, 영어 문법, 식물의 구조)",
      "difficulty": 3
    }
  ]
}`,
    maxTokens: Math.min(8000, 1200 + count * 220),
  });
  return result.questions;
}

export interface DiagnosticAnalysis {
  score: number;
  predicted_grade: string;
  percentile_band: string;
  strong_units: StrongUnit[];
  weak_units: WeakUnit[];
  ai_summary: string;
}

/** 2~4. 채점 결과 기반 예상 등급 계산 + 취약점 분석 */
export async function analyzeDiagnosticResult(
  subject: SubjectId,
  gradeLevel: string,
  answered: { content: string; unit_name: string; correct: boolean; difficulty: number }[]
): Promise<DiagnosticAnalysis> {
  return callAIForJSON<DiagnosticAnalysis>({
    system:
      "당신은 학생 실력을 진단하는 AI 교육 전문가입니다. 정오답 패턴을 분석하여 예상 등급과 취약점을 근거와 함께 제시합니다. 어투는 따뜻하지만 구체적입니다.",
    prompt: `학년: ${gradeLevel}
과목: ${SUBJECT_NAMES[subject]}
채점 결과: ${JSON.stringify(answered)}

다음 JSON 스키마로 분석 결과를 작성하세요.
{
  "score": 0~100 사이 점수,
  "predicted_grade": "A+/A/B+/B/C+/C/D 중 하나",
  "percentile_band": "상위 10%/상위 30%/상위 50%/상위 70%/하위권 중 하나",
  "strong_units": [{ "unit_id": "unit_name과 동일 문자열", "name": "단원명", "reason": "잘한 이유 한 문장" }],
  "weak_units": [{ "unit_id": "unit_name과 동일 문자열", "name": "단원명", "reason": "취약한 이유", "recommendation": "학습 방향 제안" }],
  "ai_summary": "3~4문장의 총평. 격려와 구체적 다음 스텝 포함"
}`,
    maxTokens: 2000,
  });
}
