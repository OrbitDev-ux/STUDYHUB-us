/**
 * AI가 생성한 문제 배열에 공통으로 적용하는 품질 보정 단계.
 * 프롬프트만으로는 LLM의 습성(정답을 특정 위치에 몰아 쓰거나, 여러 문제를 한 번에
 * 낼 때 표현만 바꾼 문제를 반복하는 것)을 확실히 막을 수 없어서, 파싱된 결과를
 * 코드 레벨에서 다시 한번 보정한다.
 */

/**
 * 선택지 순서를 다시 섞는다. LLM이 여러 문제를 한 번에 생성하면 정답을 항상 비슷한
 * 자리(주로 첫 번째)에 배치하는 경향이 있어, 그대로 저장하면 사용자가 위치만 보고
 * 답을 맞힐 수 있다. answer는 인덱스가 아니라 값(문자열) 그대로 저장되므로 순서를
 * 섞어도 정답 판정 로직에는 영향이 없다.
 */
export function shuffleChoices<T extends { choices: string[] | null }>(item: T): T {
  if (!item.choices || item.choices.length < 2) return item;

  const shuffled = [...item.choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return { ...item, choices: shuffled };
}

/**
 * 문제 본문이 사실상 같은 항목(공백/대소문자 차이만 있는 경우 포함)을 한 배치 안에서
 * 제거한다. 여러 문제를 한 번에 요청하면 LLM이 숫자나 어휘만 살짝 바꾼 문제를
 * 반복해서 내는 경우가 있어, 최종 개수보다 "중복 없음"을 우선한다.
 */
export function dedupeByContent<T extends { content: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.content.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/** dedupeByContent + shuffleChoices를 함께 적용하는 편의 함수 (여러 문제를 한 번에 받는 경로용). */
export function refineQuestionBatch<T extends { content: string; choices: string[] | null }>(items: T[]): T[] {
  return dedupeByContent(items).map(shuffleChoices);
}
