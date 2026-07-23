import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import type { RatingPoint } from "@/lib/battle/rating-history-types";

type HistoryRow = RatingPoint & { id?: string };
type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  subject_id: string | null;
};
type ContestRow = { id: string; title: string };
type ContestEntryRow = {
  contest_id: string;
  score: number;
  solved: number;
  penalty_seconds: number;
  final_rank?: number | null;
};
type NotificationRow = { body: string | null; created_at: string };
type HistoryResult = {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
};

const SUBJECT_LABELS: Record<string, string> = {
  math: "수학",
  english: "영어",
  social: "사회",
  science: "과학",
};

function extractNotificationReason(row: HistoryRow, notifications: NotificationRow[]) {
  const timestamp = new Date(row.created_at).getTime();
  const matched = notifications.find((notification) => {
    const distance = Math.abs(new Date(notification.created_at).getTime() - timestamp);
    return distance <= 120_000 && notification.body?.includes(`→ ${row.rating}`);
  });
  return matched?.body?.match(/사유:\s*(.*?)\s*·\s*Rating/)?.[1]?.trim() ?? null;
}

export async function getDetailedRatingHistory(userId: string, limit = 100): Promise<RatingPoint[]> {
  const admin = createAdminClient();
  const safeLimit = Math.min(Math.max(limit, 1), 300);

  let historyResult: HistoryResult = await admin.from("battle_rating_history")
    .select("id,rating,rating_change,source,created_at,event_type,event_id,event_title,opponent_id,reason,actual_rank,expected_rank,performance_rating,base_delta,correction,provisional_factor")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (historyResult.error && isMissingSchemaError(historyResult.error)) {
    historyResult = await admin.from("battle_rating_history")
      .select("id,rating,rating_change,source,created_at,event_type,event_id,reason,actual_rank,expected_rank,performance_rating,base_delta,correction,provisional_factor")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
  }
  if (historyResult.error && isMissingSchemaError(historyResult.error)) {
    historyResult = await admin.from("battle_rating_history")
      .select("id,rating,rating_change,source,created_at,event_type,event_id,actual_rank,expected_rank,performance_rating,base_delta,correction,provisional_factor")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
  }
  if (historyResult.error && isMissingSchemaError(historyResult.error)) {
    historyResult = await admin.from("battle_rating_history")
      .select("id,rating,rating_change,source,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
  }
  if (historyResult.error) {
    console.error("[rating-history]", historyResult.error.message);
    return [];
  }

  const rows = [...(historyResult.data ?? [])].reverse() as HistoryRow[];
  if (!rows.length) return [];

  const battleIds = rows
    .filter((row) => row.event_type === "battle" && row.event_id)
    .map((row) => row.event_id!);
  const contestIds = rows
    .filter((row) => row.event_type === "contest" && row.event_id)
    .map((row) => row.event_id!);

  const [matchResult, contestResult, notificationResult, initialContestEntryResult] = await Promise.all([
    battleIds.length
      ? admin.from("battle_matches")
        .select("id,player1_id,player2_id,player1_score,player2_score,subject_id")
        .in("id", battleIds)
      : Promise.resolve({ data: [] as MatchRow[], error: null }),
    contestIds.length
      ? admin.from("contests").select("id,title").in("id", contestIds)
      : Promise.resolve({ data: [] as ContestRow[], error: null }),
    admin.from("notifications").select("body,created_at")
      .eq("user_id", userId)
      .eq("type", "rating")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 2),
    contestIds.length
      ? admin.from("contest_entries")
        .select("contest_id,score,solved,penalty_seconds,final_rank")
        .eq("user_id", userId)
        .in("contest_id", contestIds)
      : Promise.resolve({ data: [] as ContestEntryRow[], error: null }),
  ]);

  let contestEntryResult = initialContestEntryResult;
  if (contestEntryResult.error && isMissingSchemaError(contestEntryResult.error)) {
    contestEntryResult = await admin.from("contest_entries")
      .select("contest_id,score,solved,penalty_seconds")
      .eq("user_id", userId)
      .in("contest_id", contestIds);
  }

  const matches = (matchResult.data ?? []) as MatchRow[];
  const opponentIds = [...new Set(matches.map((match) => (
    match.player1_id === userId ? match.player2_id : match.player1_id
  )))];
  const { data: opponentProfiles } = opponentIds.length
    ? await admin.from("profiles").select("id,nickname").in("id", opponentIds)
    : { data: [] };

  const opponentNames = new Map((opponentProfiles ?? []).map((profile) => [profile.id, profile.nickname]));
  const matchMap = new Map(matches.map((match) => [match.id, match]));
  const contestMap = new Map(((contestResult.data ?? []) as ContestRow[]).map((contest) => [contest.id, contest]));
  const contestEntryMap = new Map(((contestEntryResult.data ?? []) as ContestEntryRow[]).map((entry) => [entry.contest_id, entry]));
  const notifications = (notificationResult.data ?? []) as NotificationRow[];

  return rows.map((row) => {
    const ratingBefore = row.rating - row.rating_change;
    const eventType = row.event_type ?? (
      row.source === "contest" ? "contest"
        : row.source === "battle" ? "battle"
          : row.source === "signup" || row.source === "initial" ? "signup"
            : row.source === "admin_adjustment" ? "admin"
              : "rating"
    );

    if (eventType === "battle" && row.event_id) {
      const match = matchMap.get(row.event_id);
      if (match) {
        const isPlayer1 = match.player1_id === userId;
        const myScore = isPlayer1 ? match.player1_score : match.player2_score;
        const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
        const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
        const opponentName = opponentNames.get(opponentId) ?? "알 수 없는 상대";
        const result = myScore > opponentScore ? "승리" : myScore < opponentScore ? "패배" : "무승부";
        const subject = match.subject_id ? SUBJECT_LABELS[match.subject_id] ?? match.subject_id : "종합";
        return {
          ...row,
          rating_before: ratingBefore,
          event_type: "battle",
          event_title: row.event_title || `Battle vs ${opponentName}`,
          event_href: `/users/${opponentId}`,
          opponent_name: opponentName,
          opponent_id: opponentId,
          event_score: myScore,
          opponent_score: opponentScore,
          result_label: result,
          reason: row.reason || `${subject} 문제풀이 배틀 ${result} (${myScore}:${opponentScore})`,
        };
      }
      return {
        ...row,
        rating_before: ratingBefore,
        event_type: "battle",
        event_title: row.event_title || "Problem Battle",
        event_href: row.opponent_id ? `/users/${row.opponent_id}` : null,
        reason: row.reason || "문제풀이 배틀 결과",
      };
    }

    if (eventType === "contest") {
      const contest = row.event_id ? contestMap.get(row.event_id) : null;
      const entry = row.event_id ? contestEntryMap.get(row.event_id) : null;
      const rank = row.actual_rank ? Math.round(row.actual_rank) : entry?.final_rank ? Math.round(entry.final_rank) : null;
      return {
        ...row,
        rating_before: ratingBefore,
        event_type: "contest",
        event_title: row.event_title || contest?.title || "Rated Contest",
        event_href: row.event_id ? `/contests/${row.event_id}` : null,
        event_score: entry?.score ?? null,
        solved: entry?.solved ?? null,
        penalty_seconds: entry?.penalty_seconds ?? null,
        result_label: rank ? `${rank}위` : null,
        reason: row.reason || (rank ? `Rated 대회 ${rank}위 정산` : "Rated 대회 결과 정산"),
      };
    }

    if (eventType === "signup") {
      return {
        ...row,
        rating_before: ratingBefore,
        event_type: "signup",
        event_title: row.event_title || "Account Created",
        reason: row.reason || "가입 시 기본 Rating",
      };
    }

    if (eventType === "admin" || row.source === "admin_adjustment") {
      return {
        ...row,
        rating_before: ratingBefore,
        event_type: "admin",
        event_title: row.event_title || "Admin Rating Adjustment",
        reason: row.reason || extractNotificationReason(row, notifications) || "운영자 수동 조정",
      };
    }

    return {
      ...row,
      rating_before: ratingBefore,
      event_type: eventType,
      event_title: row.event_title || "Rating Update",
      reason: row.reason || extractNotificationReason(row, notifications) || "Rating 결과 반영",
    };
  });
}
