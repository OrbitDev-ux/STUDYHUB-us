export type JudgeVerdict =
  | "pending"
  | "judging"
  | "accepted"
  | "wrong_answer"
  | "time_limit"
  | "compilation_error"
  | "runtime_error"
  | "system_error";

export type JudgeCaseResult = {
  orderIndex: number;
  verdict: Exclude<JudgeVerdict, "pending" | "judging">;
  timeMs: number | null;
  memoryKb: number | null;
  message: string | null;
};

export type JudgeRunResult = {
  verdict: Exclude<JudgeVerdict, "pending" | "judging">;
  passedCount: number;
  testCount: number;
  score: number;
  maxTimeMs: number | null;
  maxMemoryKb: number | null;
  compileOutput: string | null;
  cases: JudgeCaseResult[];
};
