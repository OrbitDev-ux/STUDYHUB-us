export const PLANS = ["free", "basic", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LIMITS: Record<Plan, { homeworkQuestionMax: number; reportHistoryLimit: number }> = {
  free: { homeworkQuestionMax: 10, reportHistoryLimit: 14 },
  basic: { homeworkQuestionMax: 20, reportHistoryLimit: 60 },
  pro: { homeworkQuestionMax: 30, reportHistoryLimit: 365 },
};

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

export function planLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[isPlan(plan ?? "") ? (plan as Plan) : "free"];
}
