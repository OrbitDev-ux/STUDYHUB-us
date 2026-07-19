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

function fallbackDiagnosticQuestion(subject: SubjectId, index: number): GeneratedQuestion {
  if (subject === "math") {
    const left = index + 2;
    const right = (index % 7) + 1;
    const answer = String(left + right);
    return {
      content: `${left} + ${right}의 값은 무엇인가요?`,
      type: "multiple_choice",
      choices: [String(left + right - 1), answer, String(left + right + 1), String(left + right + 2)],
      answer,
      explanation: `${left}와 ${right}를 더하면 ${answer}입니다.`,
      unit_name: "수와 연산",
      difficulty: (index % 5) + 1,
    };
  }

  const banks: Record<Exclude<SubjectId, "math">, Array<Omit<GeneratedQuestion, "difficulty">>> = {
    english: [
      { content: "'apple'의 뜻은 무엇인가요?", type: "multiple_choice", choices: ["사과", "학교", "책", "물"], answer: "사과", explanation: "apple은 사과라는 뜻입니다.", unit_name: "기초 어휘" },
      { content: "빈칸에 알맞은 말은? I ___ a student.", type: "multiple_choice", choices: ["am", "is", "are", "be"], answer: "am", explanation: "주어 I 뒤에는 am을 씁니다.", unit_name: "be동사" },
      { content: "'go'의 과거형은 무엇인가요?", type: "multiple_choice", choices: ["goed", "gone", "went", "going"], answer: "went", explanation: "go의 과거형은 went입니다.", unit_name: "동사의 시제" },
    ],
    social: [
      { content: "대한민국의 수도는 어디인가요?", type: "multiple_choice", choices: ["서울", "부산", "대전", "광주"], answer: "서울", explanation: "대한민국의 수도는 서울입니다.", unit_name: "우리나라의 지리" },
      { content: "국민이 대표를 뽑는 제도는 무엇인가요?", type: "multiple_choice", choices: ["선거", "재판", "조세", "무역"], answer: "선거", explanation: "선거를 통해 국민의 대표를 선출합니다.", unit_name: "민주 정치" },
      { content: "물건과 서비스를 사고파는 활동은 무엇인가요?", type: "multiple_choice", choices: ["경제 활동", "기상 관측", "문화재 보호", "행정 구역"], answer: "경제 활동", explanation: "생산·분배·소비는 경제 활동에 속합니다.", unit_name: "경제 생활" },
    ],
    science: [
      { content: "물이 표준 기압에서 끓는 온도는 몇 도인가요?", type: "multiple_choice", choices: ["0℃", "50℃", "100℃", "200℃"], answer: "100℃", explanation: "표준 기압에서 물의 끓는점은 100℃입니다.", unit_name: "물질의 상태" },
      { content: "식물이 빛을 이용해 양분을 만드는 과정은 무엇인가요?", type: "multiple_choice", choices: ["광합성", "호흡", "증발", "응결"], answer: "광합성", explanation: "식물은 광합성으로 양분을 만듭니다.", unit_name: "식물과 에너지" },
      { content: "지구가 태양 주위를 도는 운동은 무엇인가요?", type: "multiple_choice", choices: ["자전", "공전", "진동", "대류"], answer: "공전", explanation: "지구가 태양 주위를 도는 운동을 공전이라고 합니다.", unit_name: "지구와 우주" },
    ],
  };
  const template = banks[subject][index % banks[subject].length]!;
  return { ...template, difficulty: (index % 5) + 1 };
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
    fallback: () => ({
      questions: Array.from({ length: count }, (_, index) => fallbackDiagnosticQuestion(subject, index)),
    }),
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
    fallback: () => {
      const score = Math.round((answered.filter((item) => item.correct).length / Math.max(answered.length, 1)) * 100);
      const grade = score >= 95 ? "A+" : score >= 85 ? "A" : score >= 75 ? "B+" : score >= 65 ? "B" : score >= 55 ? "C+" : score >= 45 ? "C" : "D";
      const band = score >= 90 ? "상위 10%" : score >= 70 ? "상위 30%" : score >= 50 ? "상위 50%" : score >= 30 ? "상위 70%" : "하위권";
      const byUnit = new Map<string, { correct: number; total: number }>();
      for (const item of answered) {
        const current = byUnit.get(item.unit_name) ?? { correct: 0, total: 0 };
        current.total += 1;
        if (item.correct) current.correct += 1;
        byUnit.set(item.unit_name, current);
      }
      const strong_units: StrongUnit[] = [];
      const weak_units: WeakUnit[] = [];
      for (const [name, stats] of byUnit) {
        if (stats.correct / stats.total >= 0.7) {
          strong_units.push({ unit_id: name, name, reason: "이 단원의 정답률이 높습니다." });
        } else {
          weak_units.push({ unit_id: name, name, reason: "이 단원의 오답 비율이 높습니다.", recommendation: "핵심 개념을 복습한 뒤 기본 문제부터 다시 풀어보세요." });
        }
      }
      return {
        score,
        predicted_grade: grade,
        percentile_band: band,
        strong_units,
        weak_units,
        ai_summary: `이번 진단평가 점수는 ${score}점입니다. 잘한 단원은 유지하고, 오답이 많았던 단원은 개념 복습부터 차근차근 시작해보세요.`,
      };
    },
  });
}
