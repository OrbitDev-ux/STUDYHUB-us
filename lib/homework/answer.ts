/**
 * 학생 답과 정답을 비교할 때 입력 방식의 사소한 차이는 무시한다.
 * NFKC는 전각 문자 등을 정규화하고, O/X 문제의 흔한 표기도 한 값으로 맞춘다.
 */
export function normalizeAnswer(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?。！？]+$/g, "");

  if (["o", "○", "⭕", "true", "맞다", "참"].includes(normalized)) return "o";
  if (["x", "×", "✕", "false", "아니다", "거짓"].includes(normalized)) return "x";
  return normalized;
}

export function answersMatch(expected: string, actual: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}
