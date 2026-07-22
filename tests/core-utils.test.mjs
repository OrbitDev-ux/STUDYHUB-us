import test from "node:test";
import assert from "node:assert/strict";
import { answersMatch, normalizeAnswer } from "../lib/homework/answer.ts";
import { calculateLevel, getLevelProgress, xpThresholdForLevel } from "../lib/gamification/level.ts";
import { planLimits } from "../lib/plan.ts";
import { creditSessionDuration } from "../lib/timer/session.ts";

test("답안 비교는 공백·대소문자·전각 문자를 정규화한다", () => {
  assert.equal(answersMatch("Apple", "  apple. "), true);
  assert.equal(answersMatch("Ａ", "a"), true);
  assert.equal(normalizeAnswer(" 참 "), "o");
  assert.equal(answersMatch("X", "거짓"), true);
  assert.equal(answersMatch("서울", "부산"), false);
});

test("레벨 경계와 진행률 계산이 일관된다", () => {
  assert.equal(xpThresholdForLevel(1), 0);
  assert.equal(xpThresholdForLevel(2), 100);
  assert.equal(xpThresholdForLevel(3), 250);
  assert.equal(calculateLevel(249), 2);
  assert.equal(calculateLevel(250), 3);
  assert.deepEqual(getLevelProgress(175), {
    level: 2,
    xp: 175,
    currentLevelXp: 100,
    nextLevelXp: 250,
    progressPercent: 50,
  });
});

test("알 수 없는 플랜은 안전하게 무료 플랜 제한을 사용한다", () => {
  assert.deepEqual(planLimits("invalid"), { homeworkQuestionMax: 10, reportHistoryLimit: 14 });
  assert.equal(planLimits("pro").homeworkQuestionMax, 30);
});

test("타이머 인정 시간은 실제 서버 경과 시간을 넘지 않는다", () => {
  assert.deepEqual(
    creditSessionDuration({ requestedFocusMinutes: 240, requestedBreakMinutes: 50, startedAtMs: 0, nowMs: 90_000 }),
    { elapsedSeconds: 90, focusMinutes: 2, breakMinutes: 0 }
  );
  assert.deepEqual(
    creditSessionDuration({ requestedFocusMinutes: 25, requestedBreakMinutes: 5, startedAtMs: 0, nowMs: 30 * 60_000 }),
    { elapsedSeconds: 1800, focusMinutes: 25, breakMinutes: 5 }
  );
});
