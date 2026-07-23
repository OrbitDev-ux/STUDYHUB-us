import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { getPracticeQuestion, type GradeLevel, type PracticeQuestion } from "@/lib/practice/question-bank";
import type { SubjectId } from "@/types";
import { isMissingSchemaError } from "@/lib/developer/schema-status";

type DatabaseQuestion = {
  id: string;
  subject_id: SubjectId;
  grade_level: GradeLevel | null;
  unit_name: string | null;
  difficulty: number;
  content: string;
  choices: unknown;
  answer: string;
  explanation: string | null;
  status: string;
};

type LegacyDatabaseQuestion = Omit<DatabaseQuestion, "grade_level" | "unit_name" | "status"> & {
  source: string;
  units: { name: string; grade_level: GradeLevel | null } | Array<{ name: string; grade_level: GradeLevel | null }> | null;
};

function fromLegacyDatabase(row: LegacyDatabaseQuestion) {
  const unit = Array.isArray(row.units) ? row.units[0] : row.units;
  return fromDatabase({
    ...row,
    grade_level: unit?.grade_level ?? null,
    unit_name: unit?.name ?? "직접 출제",
    status: row.source.endsWith(":draft") ? "draft" : row.source.endsWith(":archived") ? "archived" : "published",
  });
}

function fromDatabase(row: DatabaseQuestion): PracticeQuestion | null {
  if (!row.grade_level || !Array.isArray(row.choices) || row.choices.some((choice) => typeof choice !== "string")) return null;
  return {
    key: `db:${row.id}`,
    gradeLevel: row.grade_level,
    subjectId: row.subject_id,
    unitName: row.unit_name || "직접 출제",
    difficulty: Math.min(5, Math.max(1, row.difficulty)) as 1 | 2 | 3 | 4 | 5,
    content: row.content,
    choices: row.choices as string[],
    answer: row.answer,
    explanation: row.explanation || "관리자가 직접 출제한 문제입니다.",
  };
}

export async function resolvePracticeQuestion(questionKey: string) {
  const generated = getPracticeQuestion(questionKey);
  if (generated) return generated;
  const match = /^db:([0-9a-f-]{36})$/i.exec(questionKey);
  if (!match) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("questions")
    .select("id, subject_id, grade_level, unit_name, difficulty, content, choices, answer, explanation, status")
    .eq("id", match[1]!).neq("status", "draft").maybeSingle();
  if (!error) return data ? fromDatabase(data as DatabaseQuestion) : null;
  if (!isMissingSchemaError(error)) return null;
  const { data: legacy } = await admin.from("questions")
    .select("id, subject_id, difficulty, content, choices, answer, explanation, source, units(name, grade_level)")
    .eq("id", match[1]!).maybeSingle();
  if (!legacy || String(legacy.source).endsWith(":draft")) return null;
  return fromLegacyDatabase(legacy as unknown as LegacyDatabaseQuestion);
}

export async function resolvePracticeQuestions(questionKeys: string[]) {
  const databaseIds = questionKeys.flatMap((key) => {
    const match = /^db:([0-9a-f-]{36})$/i.exec(key);
    return match ? [match[1]!] : [];
  });
  const admin = createAdminClient();
  const modern = databaseIds.length
    ? await admin.from("questions")
      .select("id, subject_id, grade_level, unit_name, difficulty, content, choices, answer, explanation, status")
      .in("id", databaseIds).neq("status", "draft")
    : { data: [], error: null };
  let databaseMap: Map<string, PracticeQuestion | null>;
  if (!modern.error) {
    databaseMap = new Map((modern.data ?? []).map((row) => [`db:${row.id}`, fromDatabase(row as DatabaseQuestion)]));
  } else if (isMissingSchemaError(modern.error)) {
    const { data: legacyRows } = await admin.from("questions")
      .select("id, subject_id, difficulty, content, choices, answer, explanation, source, units(name, grade_level)")
      .in("id", databaseIds);
    databaseMap = new Map((legacyRows ?? [])
      .filter((row) => !String(row.source).endsWith(":draft"))
      .map((row) => [`db:${row.id}`, fromLegacyDatabase(row as unknown as LegacyDatabaseQuestion)]));
  } else {
    databaseMap = new Map();
  }
  return questionKeys.flatMap((key) => {
    const question = getPracticeQuestion(key) ?? databaseMap.get(key);
    return question ? [question] : [];
  });
}
