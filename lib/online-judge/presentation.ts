import type { JudgeVerdict } from "./types";

export const VERDICT_LABEL: Record<JudgeVerdict, string> = {
  pending: "Pending",
  judging: "Judging",
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit: "Time Limit Exceeded",
  compilation_error: "Compilation Error",
  runtime_error: "Runtime Error",
  system_error: "System Error",
};

export function verdictClass(verdict: JudgeVerdict) {
  if (verdict === "accepted") return "text-success";
  if (verdict === "pending" || verdict === "judging") return "text-warning";
  return "text-destructive";
}
