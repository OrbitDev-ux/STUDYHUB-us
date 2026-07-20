/** 숙제 문항 배열로 완료율/정답률을 계산한다 (report 액션과 daily-feedback 크론이 공유). */
export function computeHomeworkCompletionStats(items: { is_correct: boolean | null }[]) {
  const answered = items.filter((i) => i.is_correct !== null);
  const correct = items.filter((i) => i.is_correct === true);
  const completionRate = items.length ? Math.round((answered.length / items.length) * 100) : 0;
  const correctRate = answered.length ? Math.round((correct.length / answered.length) * 100) : 0;
  return { completionRate, correctRate };
}
