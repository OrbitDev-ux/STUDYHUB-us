/**
 * XP -> 레벨 공식의 TypeScript 미러입니다.
 * 실제 레벨 계산/저장은 DB 함수 `calculate_level()` (supabase/migrations/0002_leaderboard_and_xp_fix.sql)
 * 에서 원자적으로 수행되며, 이 파일은 UI에서 "다음 레벨까지 남은 XP" 진행률을 보여주기 위한
 * 순수 계산 함수만 제공합니다. 두 구현은 반드시 동일한 공식을 유지해야 합니다.
 *
 * 레벨업에 필요한 누적 XP가 레벨마다 50씩 늘어나는 계단식 증가:
 * Lv1: 0xp, Lv2: 100xp, Lv3: 250xp, Lv4: 450xp, Lv5: 700xp, Lv6: 1000xp ...
 */

export interface LevelProgress {
  level: number;
  xp: number;
  /** 현재 레벨 시작 시점의 누적 XP */
  currentLevelXp: number;
  /** 다음 레벨 도달에 필요한 누적 XP (null이면 계산 상한 도달) */
  nextLevelXp: number;
  /** 현재 레벨 구간 내 진행률 (0~100) */
  progressPercent: number;
}

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  let required = 0;
  let step = 100;
  for (let l = 1; l < level; l++) {
    required += step;
    step += 50;
  }
  return required;
}

export function calculateLevel(xp: number): number {
  if (!xp || xp < 0) return 1;
  let level = 1;
  let required = 0;
  let step = 100;
  while (xp >= required + step) {
    required += step;
    level += 1;
    step += 50;
  }
  return level;
}

export function getLevelProgress(xp: number): LevelProgress {
  const safeXp = xp && xp > 0 ? xp : 0;
  const level = calculateLevel(safeXp);
  const currentLevelXp = xpThresholdForLevel(level);
  const nextLevelXp = xpThresholdForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  const progressPercent = span > 0 ? Math.min(100, Math.round(((safeXp - currentLevelXp) / span) * 100)) : 100;

  return { level, xp: safeXp, currentLevelXp, nextLevelXp, progressPercent };
}
