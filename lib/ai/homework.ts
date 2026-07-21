import { callAIForJSON } from "./client";
import { planLimits } from "@/lib/plan";
import { refineQuestionBatch, shuffleChoices } from "./question-quality";
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
  /** 사용자가 설정 페이지에서 요청한 총 문제 수 (settings.homework_question_count) — 플랜 상한으로 클램프된다 */
  requestedQuestionCount: number;
  plan: string | null | undefined;
}

function fallbackHomeworkItem(
  subject: SubjectId,
  index: number,
  unitName: string,
  category: GeneratedHomeworkItem["category"]
): GeneratedHomeworkItem {
  const difficulty = (index % 3) + 1;
  if (subject === "math") {
    const left = index + 3;
    const right = (index % 5) + 2;
    const answer = String(left * right);
    return { content: `${left} × ${right}의 값은 무엇인가요?`, type: "multiple_choice", choices: [String(left + right), answer, String(left * right + 1), String(left * right - 1)], answer, explanation: `${left}를 ${right}번 더하면 ${answer}입니다.`, subject_id: subject, unit_name: unitName, category, difficulty };
  }
  if (subject === "english") {
    return { content: "빈칸에 알맞은 말은? She ___ kind.", type: "multiple_choice", choices: ["am", "is", "are", "be"], answer: "is", explanation: "3인칭 단수 주어 She 뒤에는 is를 씁니다.", subject_id: subject, unit_name: unitName, category, difficulty };
  }
  if (subject === "social") {
    return { content: "국민이 대표자를 직접 선택하는 제도는 무엇인가요?", type: "multiple_choice", choices: ["선거", "재판", "조세", "무역"], answer: "선거", explanation: "선거는 국민이 대표자를 선택하는 민주주의의 기본 제도입니다.", subject_id: subject, unit_name: unitName, category, difficulty };
  }
  return { content: "식물이 빛을 이용해 양분을 만드는 과정은 무엇인가요?", type: "multiple_choice", choices: ["광합성", "증발", "응결", "연소"], answer: "광합성", explanation: "식물은 빛에너지를 이용한 광합성으로 양분을 만듭니다.", subject_id: subject, unit_name: unitName, category, difficulty };
}

/** 매일 숙제 자동 생성 — 취약 단원 + 오답 복습 위주, 총 문제 수는 사용자 설정(플랜 상한 이내)을 따른다 */
export async function generateDailyHomework(
  input: HomeworkGenerationInput
): Promise<{ rationale: string; items: GeneratedHomeworkItem[] }> {
  // 호출부마다 플랜 상한을 따로 적용하면 클램프를 빼먹은 경로가 생길 수 있으므로,
  // 생성 함수 자체에서 항상 적용한다.
  const requestedCount = Number.isFinite(input.requestedQuestionCount) ? Math.round(input.requestedQuestionCount) : 10;
  const questionCount = Math.max(5, Math.min(requestedCount, planLimits(input.plan).homeworkQuestionMax));

  // 최근 오답이 없으면(예: 크론 경로는 항상 빈 배열로 호출) 복습 문제를 요구하지 않는다.
  // 데이터 없이 "오답 복습 N개 필수"를 강제하면 AI가 없는 오답을 지어내게 된다.
  const reviewCount =
    input.wrongQuestionSummaries.length === 0
      ? 0
      : Math.max(0, Math.min(5, Math.round(questionCount * 0.2), input.wrongQuestionSummaries.length));
  const newCount = questionCount - reviewCount;

  const reviewGuide =
    reviewCount > 0
      ? `- 그 중 ${reviewCount}문제는 최근 오답을 변형하여 재출제 (category: "오답복습")\n- 나머지 ${newCount}문제는`
      : `- 최근 오답 데이터가 없으므로 오답 복습 문제는 포함하지 마세요.\n- ${newCount}문제 전부`;

  const result = await callAIForJSON<{ rationale: string; items: GeneratedHomeworkItem[] }>({
    system:
      "당신은 학생 개인별 취약점에 맞춰 매일 숙제를 설계하는 AI 과외 선생님입니다. 신규 문제와 오답 복습을 균형 있게 배치합니다.",
    prompt: `학년: ${input.gradeLevel}
목표 학습시간: ${input.targetMinutes}분
과목별 취약 단원: ${JSON.stringify(input.weakUnitsBySubject)}
최근 오답: ${JSON.stringify(input.wrongQuestionSummaries)}

위 정보를 바탕으로 오늘의 숙제를 총 ${questionCount}문제로 생성하세요. 구성 가이드:
- 총 문제 수는 반드시 ${questionCount}개여야 합니다.
${reviewGuide} 취약 단원 위주의 신규 문제로, 수학/영어/사회/과학에 균형 있게 배분
  (영어는 단어 문제(category: "단어")와 문법 문제(category: "신규")를 섞어도 됩니다)
- category는 "신규" 또는 "오답복습" 또는 "단어" 중 하나
- ${questionCount}문제는 서로 내용이 겹치거나 숫자·표현만 바꾼 유사 문제가 없도록 각각 확실히 다른 내용으로 출제하세요.
- choices 안에서 정답의 위치도 문제마다 골고루 바뀌게 하세요 — 정답을 매번 같은 자리에 두지 마세요.

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
    maxTokens: Math.min(8000, 1500 + questionCount * 220),
    fallback: () => {
      const subjects: SubjectId[] = ["math", "english", "social", "science"];
      const items = Array.from({ length: questionCount }, (_, index) => {
        const wrong = input.wrongQuestionSummaries[index];
        const subject = wrong?.subject ?? subjects[index % subjects.length]!;
        const weak = input.weakUnitsBySubject.find((row) => row.subject === subject)?.units[0];
        const unitName = wrong?.unit ?? weak ?? ({ math: "수와 연산", english: "영어 문법", social: "민주 정치", science: "생명과학" }[subject]);
        const category: GeneratedHomeworkItem["category"] = index < reviewCount ? "오답복습" : subject === "english" && index % 2 === 0 ? "단어" : "신규";
        return fallbackHomeworkItem(subject, index, unitName, category);
      });
      return {
        rationale: "현재 학습 정보와 취약 단원을 바탕으로 네 과목을 균형 있게 연습하도록 구성했습니다. 기본 개념을 확인한 뒤 점차 난이도를 높여보세요.",
        items,
      };
    },
  });

  return { ...result, items: refineQuestionBatch(result.items) };
}

/** 오답노트에서 유사 문제 재생성 */
export async function generateSimilarQuestion(original: {
  content: string;
  subject_id: SubjectId;
  unit_name: string;
  difficulty: number;
}): Promise<GeneratedHomeworkItem> {
  const item = await callAIForJSON<GeneratedHomeworkItem>({
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
    fallback: () => fallbackHomeworkItem(original.subject_id, 1, original.unit_name, "오답복습"),
  });

  return shuffleChoices(item);
}
