export type SubjectId = "math" | "english" | "social" | "science";

export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  grade_level: string | null;
  target_score: string | null;
  target_study_minutes: number;
  exam_date: string | null;
  onboarding_completed: boolean;
  xp: number;
  coins: number;
  level: number;
  streak_days: number;
  last_study_date: string | null;
  role: "user" | "admin";
  plan: "free" | "basic" | "pro";
}

export interface WeakUnit {
  unit_id: string;
  name: string;
  reason: string;
  recommendation: string;
}

export interface StrongUnit {
  unit_id: string;
  name: string;
  reason: string;
}

export interface DiagnosticResult {
  id: string;
  user_id: string;
  subject_id: SubjectId;
  score: number;
  predicted_grade: string;
  percentile_band: string;
  strong_units: StrongUnit[];
  weak_units: WeakUnit[];
  ai_summary: string;
  created_at: string;
}

export interface Question {
  id: string;
  subject_id: SubjectId;
  unit_id: string | null;
  type: "multiple_choice" | "short_answer" | "ox";
  difficulty: number;
  content: string;
  choices: string[] | null;
  answer: string;
  explanation: string | null;
}

export interface HomeworkItem {
  id: string;
  question: Question;
  category: string;
  order_index: number;
  user_answer: string | null;
  is_correct: boolean | null;
}

export interface Homework {
  id: string;
  date: string;
  status: "pending" | "in_progress" | "completed";
  ai_rationale: string;
  items: HomeworkItem[];
}

export interface StudyPlanItem {
  id: string;
  subject_id: SubjectId | null;
  unit_id: string | null;
  title: string;
  planned_minutes: number;
  priority: 1 | 2 | 3;
  type: "new" | "review";
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  date: string;
  total_planned_minutes: number;
  ai_summary: string;
  items: StudyPlanItem[];
}

export interface AdminStats {
  total_users: number;
  new_users_today: number;
  new_users_week: number;
  admin_count: number;
  plan_free: number;
  plan_basic: number;
  plan_pro: number;
  dau: number;
  study_minutes_today: number;
  homeworks_today: number;
  homeworks_completed_today: number;
  discord_linked: number;
  maintenance_mode: boolean;
}

export interface AdminUserSummary {
  id: string;
  nickname: string;
  grade_level: string | null;
  plan: "free" | "basic" | "pro";
  role: "user" | "admin";
  level: number;
  streak_days: number;
  created_at: string;
}

export interface AdminUserSearchResult {
  id: string;
  nickname: string;
  email: string;
  plan: "free" | "basic" | "pro";
  role: "user" | "admin";
}

export interface DailyFeedback {
  id: string;
  date: string;
  study_minutes: number;
  goal_achievement_rate: number;
  improved_units: string[];
  recommended_next: string;
  ai_message: string;
}
