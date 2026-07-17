const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

interface AICallOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/**
 * Anthropic Messages API를 호출하고 JSON 응답만 강제로 받아 파싱합니다.
 * 서버 전용 함수입니다 (ANTHROPIC_API_KEY는 절대 클라이언트에 노출 금지).
 */
export async function callAIForJSON<T>({ system, prompt, maxTokens = 2000 }: AICallOptions): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요."
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: `${system}\n\n반드시 순수 JSON만 응답하세요. 마크다운 코드블록(\`\`\`)이나 설명 문장을 절대 포함하지 마세요.`,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 호출 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  if (!textBlock) throw new Error("AI 응답에 텍스트 블록이 없습니다.");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`AI 응답 JSON 파싱 실패: ${cleaned.slice(0, 300)}`);
  }
}
