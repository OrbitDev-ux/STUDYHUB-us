import { callAIForJSON } from "./client";
import type { SubjectId } from "@/types";

export interface GeneratedHomeworkItem {
  content: string;
  type: "multiple_choice" | "short_answer" | "ox";
  choices: string[] | null;
  answer: string;
  explanation: string;
  subject_id: SubjectId;
  unit_name: string;
  category: "신규" | "오답복습" | "단어";
  difficulty: number;
}

interface HomeworkGenerationInput {
  gradeLevel: string;
  weakUnitsBySubject: { subject: SubjectId; units: string[] }[];
  wrongQuestionSummaries: { subject: SubjectId; unit: string; content: string }[];
  targetMinutes: number;
  /** 사용자가 설정 페이지에서 조절하는 총 문제 수 (settings.homework_question_count, 5~30) */
  questionCount: number;
}

/** 매일 숙제 자동 생성 — 취약 단원 + 오답 복습 위주, 총 문제 수는 사용자 설정을 따른다 */
export async function generateDailyHomework(
  input: HomeworkGenerationInput
): Promise<{ rationale: string; items: GeneratedHomeworkItem[] }> {
  const reviewCount = Math.max(0, Math.min(5, Math.round(input.questionCount * 0.2)));
  const newCount = input.questionCount - reviewCount;

  return callAIForJSON<{ rationale: string; items: GeneratedHomeworkItem[] }>({
    system:
      "당신은 학생 개인별 취약점에 맞춰 매일 숙제를 설계하는 AI 과외 선생님입니다. 신규 문제와 오답 복습을 균형 있게 배치합니다.",
    prompt: `학년: ${input.gradeLevel}
목표 학습시간: ${input.targetMinutes}분
과목별 취약 단원: ${JSON.stringify(input.weakUnitsBySubject)}
최근 오답: ${JSON.stringify(input.wrongQuestionSummaries)}

위 정보를 바탕으로 오늘의 숙제를 총 ${input.questionCount}문제로 생성하세요. 구성 가이드:
- 총 문제 수는 반드시 ${input.questionCount}개여야 합니다.
- 그 중 ${reviewCount}문제는 최근 오답을 변형하여 재출제 (category: "오답복습")
- 나머지 ${newCount}문제는 취약 단원 위주의 신규 문제로, 수학/영어/사회/과학에 균형 있게 배분
  (영어는 단어 문제(category: "단어")와 문법 문제(category: "신규")를 섞어도 됩니다)
- category는 "신규" 또는 "오답복습" 또는 "단어" 중 하나

JSON 스키마:
{
  "rationale": "이 숙제를 이렇게 구성한 이유 (취약 단원 근거 포함, 2~3문장)",
  "items": [
    {
      "content": "문제 본문",
      "type": "multiple_choice",
      "choices": ["a","b","c","d"] 또는 null,
      "answer": "정답",
      "explanation": "해설",
      "subject_id": "math",
      "unit_name": "단원명",
      "category": "신규",
      "difficulty": 3
    }
  ]
}`,
    maxTokens: Math.min(8000, 1500 + input.questionCount * 220),
  });
}

/** 오답노트에서 유사 문제 재생성 */
export async function generateSimilarQuestion(original: {
  content: string;
  subject_id: SubjectId;
  unit_name: string;
  difficulty: number;
}): Promise<GeneratedHomeworkItem> {
  return callAIForJSON<GeneratedHomeworkItem>({
    system: "당신은 원본 문제와 동일한 개념·난이도의 유사 문제를 새로 출제하는 AI입니다.",
    prompt: `원본 문제: ${original.content}
과목: ${original.subject_id}, 단원: ${original.unit_name}, 난이도: ${original.difficulty}

동일 개념을 다루되 숫자/상황을 바꾼 새 문제 1개를 아래 JSON 스키마로 생성하세요.
{
  "content": "문제 본문",
  "type": "multiple_choice",
  "choices": ["a","b","c","d"] 또는 null,
  "answer": "정답",
  "explanation": "해설",
  "subject_id": "${original.subject_id}",
  "unit_name": "${original.unit_name}",
  "category": "오답복습",
  "difficulty": ${original.difficulty}
}`,
    maxTokens: 1000,
  });
}
