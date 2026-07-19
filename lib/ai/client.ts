const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const GLM_API_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const GLM_MODEL = "glm-5.2-lite";
const AI_TIMEOUT_MS = 60_000;
const AI_MAX_ATTEMPTS = 3;

interface AICallOptions<T> {
  system: string;
  prompt: string;
  maxTokens?: number;
  fallback?: () => T;
}

function getProvider(): "anthropic" | "glm" {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "glm" ? "glm" : "anthropic";
}

async function fetchAI(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === AI_MAX_ATTEMPTS) return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === AI_MAX_ATTEMPTS) break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
  }

  throw new Error(`AI 서비스 연결 실패: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

/**
 * AI_PROVIDER 환경변수(anthropic 기본값 / glm)에 따라 Anthropic Messages API 또는
 * GLM(Z.ai) Chat Completions API를 호출하고 JSON 응답만 강제로 받아 파싱합니다.
 * 서버 전용 함수입니다 (API 키는 절대 클라이언트에 노출 금지).
 */
export async function callAIForJSON<T>({ system, prompt, maxTokens = 2000, fallback }: AICallOptions<T>): Promise<T> {
  const jsonSystem = `${system}\n\n반드시 순수 JSON만 응답하세요. 마크다운 코드블록(\`\`\`)이나 설명 문장을 절대 포함하지 마세요.`;

  try {
    const text =
      getProvider() === "glm"
        ? await callGLM(jsonSystem, prompt, maxTokens)
        : await callAnthropic(jsonSystem, prompt, maxTokens);
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch (error) {
    if (fallback) {
      console.error("[ai] provider call failed; using deterministic fallback:", error);
      return fallback();
    }
    throw error;
  }
}

async function callAnthropic(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요.");
  }

  const res = await fetchAI(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
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
  return textBlock.text;
}

async function callGLM(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error("GLM_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요.");
  }

  const res = await fetchAI(GLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 호출 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답에 텍스트가 없습니다.");
  return content;
}
