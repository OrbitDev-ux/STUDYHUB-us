export interface ActivityDay {
  date: string;
  minutes: number;
  problems: number;
  completions: number;
  score: number;
}

function fromDateKey(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, amount: number) {
  const date = fromDateKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

/** 현재 주를 포함한 53주(일요일 시작)의 GitHub형 잔디 날짜를 만든다. */
export function heatmapDateRange(today: string) {
  const end = fromDateKey(today);
  const currentSunday = new Date(end);
  currentSunday.setUTCDate(end.getUTCDate() - end.getUTCDay());
  const start = new Date(currentSunday);
  start.setUTCDate(start.getUTCDate() - 52 * 7);
  const days: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) days.push(dateKey(cursor));
  return days;
}

export function calculateStreaks(days: ActivityDay[], today: string) {
  const active = new Set(days.filter((day) => day.score > 0).map((day) => day.date));
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let previous = "";
  for (const date of sorted) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  let cursor = active.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) { current += 1; cursor = addDays(cursor, -1); }
  return { current, longest, activeDays: active.size };
}

export function activityLevel(score: number) {
  if (score <= 0) return 0;
  if (score < 2) return 1;
  if (score < 5) return 2;
  if (score < 9) return 3;
  return 4;
}
