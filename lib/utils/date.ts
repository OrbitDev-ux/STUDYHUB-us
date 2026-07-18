const KST_TIME_ZONE = "Asia/Seoul";

/**
 * 한국 표준시(KST, UTC+9) 기준 오늘 날짜를 "YYYY-MM-DD" 형식으로 반환한다.
 *
 * `new Date().toISOString().slice(0, 10)`는 UTC 기준 날짜를 반환하므로,
 * 자정~오전 9시(KST) 사이에는 실제로는 다음 날인데도 전날 날짜가 나온다.
 * 이 앱은 한국 사용자를 대상으로 "오늘의 숙제/플래너"를 하루 단위로 관리하므로
 * 반드시 KST 기준으로 날짜를 계산해야 한다.
 */
export function todayKST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 현재 KST 기준 시(0~23)를 반환한다. */
export function currentHourKST(date: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // Intl은 자정을 "24"로 표기하는 로케일 데이터가 있어 24 -> 0으로 보정한다.
  return Number(hour) % 24;
}
