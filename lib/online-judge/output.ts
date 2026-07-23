export function normalizeJudgeOutput(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function judgeOutputsMatch(submitted: string, expected: string) {
  return normalizeJudgeOutput(submitted) === normalizeJudgeOutput(expected);
}
