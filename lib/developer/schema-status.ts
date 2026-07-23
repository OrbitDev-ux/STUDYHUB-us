import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DeveloperSchemaStatus = {
  questionMetadata: boolean;
  contestPublishing: boolean;
  auditLog: boolean;
  ratingNotifications: boolean;
  ratingAdjustmentRpc: boolean;
  ratingEventDetails: boolean;
  ratingHistoryManagement: boolean;
  directBattleChallenges: boolean;
  adminForumAnnouncements: boolean;
  chatSafety: boolean;
  superAdminPermissions: boolean;
};

export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return ["42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")
    || /schema cache|does not exist|could not find/i.test(error.message ?? "");
}

export async function getDeveloperSchemaStatus(admin: SupabaseClient): Promise<DeveloperSchemaStatus> {
  const [
    questionMetadata,
    contestPublishing,
    auditLog,
    ratingNotifications,
    ratingAdjustmentRpc,
    ratingEventDetails,
    ratingHistoryManagement,
    directBattleChallenges,
    adminForumAnnouncements,
    chatSafety,
    superAdminPermissions,
  ] = await Promise.all([
    admin.from("questions").select("id,grade_level,status").limit(1),
    admin.from("contests").select("id,publication_status").limit(1),
    admin.from("developer_audit_logs").select("id").limit(1),
    admin.from("battle_rating_history").select("id,reason").limit(1),
    admin.rpc("admin_adjust_rating", {
      p_target_user_id: "00000000-0000-0000-0000-000000000000",
      p_rating: 1200,
      p_reason: "schema capability probe",
    }),
    admin.from("battle_rating_history").select("id,event_title,opponent_id").limit(1),
    admin.rpc("admin_delete_rating_history", {
      p_history_id: "00000000-0000-0000-0000-000000000000",
      p_reason: "schema capability probe",
    }),
    admin.from("battle_challenges").select("id,status").limit(1),
    admin.rpc("create_admin_forum_announcement", {
      p_title: "",
      p_content: "",
    }),
    admin.from("message_reports").select("id,status").limit(1),
    admin.from("developer_audit_log_revisions").select("id,operation").limit(1),
  ]);
  return {
    questionMetadata: !questionMetadata.error,
    contestPublishing: !contestPublishing.error,
    auditLog: !auditLog.error,
    ratingNotifications: !ratingNotifications.error,
    ratingAdjustmentRpc: !ratingAdjustmentRpc.error || !isMissingSchemaError(ratingAdjustmentRpc.error),
    ratingEventDetails: !ratingEventDetails.error,
    ratingHistoryManagement: !ratingHistoryManagement.error || !isMissingSchemaError(ratingHistoryManagement.error),
    directBattleChallenges: !directBattleChallenges.error,
    adminForumAnnouncements: !adminForumAnnouncements.error || !isMissingSchemaError(adminForumAnnouncements.error),
    chatSafety: !chatSafety.error,
    superAdminPermissions: !superAdminPermissions.error,
  };
}
