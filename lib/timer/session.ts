export const MAX_SESSION_MINUTES = 240;
export const MIN_SESSION_SECONDS = 30;

export function creditSessionDuration(input: {
  requestedFocusMinutes: number;
  requestedBreakMinutes: number;
  startedAtMs: number;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const elapsedSeconds = Number.isFinite(input.startedAtMs)
    ? Math.max(0, Math.floor((nowMs - input.startedAtMs) / 1000))
    : 0;
  const elapsedMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
  const focusMinutes = Math.min(safeMinutes(input.requestedFocusMinutes), MAX_SESSION_MINUTES, elapsedMinutes);
  const breakMinutes = Math.min(
    safeMinutes(input.requestedBreakMinutes),
    MAX_SESSION_MINUTES,
    Math.max(0, elapsedMinutes - focusMinutes)
  );

  return { elapsedSeconds, focusMinutes, breakMinutes };
}

function safeMinutes(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}
