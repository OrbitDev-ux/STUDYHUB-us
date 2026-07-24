import "server-only";

import { normalizeRatingTiers, ratingTier } from "@/lib/battle/rating";
import { createAdminClient } from "@/lib/supabase/server";

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  managed: boolean;
};

const DISCORD_API = "https://discord.com/api/v10";

function configuration() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
  const prefix = (process.env.DISCORD_RATING_ROLE_PREFIX || "StudyHub · ").slice(0, 50);
  return token && guildId ? { token, guildId, prefix } : null;
}

async function discordRequest(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response | null> {
  try {
    return await fetch(`${DISCORD_API}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(5_000),
      headers: {
        Authorization: `Bot ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

async function ratingContext(userId: string) {
  const admin = createAdminClient();
  const [{ data: rating }, { data: settings }] = await Promise.all([
    admin.from("battle_ratings").select("rating").eq("user_id", userId).maybeSingle(),
    admin.from("app_settings").select("rating_tiers").eq("id", true).maybeSingle(),
  ]);
  const tiers = normalizeRatingTiers(settings?.rating_tiers);
  const currentRating = Number(rating?.rating ?? 1200);
  return { tiers, currentRating, tier: ratingTier(currentRating, tiers) };
}

async function getGuildRoles(token: string, guildId: string): Promise<DiscordRole[] | null> {
  const response = await discordRequest(`/guilds/${guildId}/roles`, token);
  if (!response?.ok) return null;
  try {
    return (await response.json()) as DiscordRole[];
  } catch {
    return null;
  }
}

/**
 * OAuth 저장 직후 호출되는 즉시 동기화 경로다. 봇 Realtime 브리지가 주 경로이고,
 * 이 함수는 봇 프로세스가 이벤트를 받기 전에도 역할을 바로 지급하는 서버 측 보강이다.
 */
export async function syncDiscordRatingRole(
  discordUserId: string,
  studyHubUserId: string
): Promise<boolean> {
  const config = configuration();
  if (!config) return false;

  const { tier } = await ratingContext(studyHubUserId);
  const roles = await getGuildRoles(config.token, config.guildId);
  if (!roles) return false;

  const expectedName = `${config.prefix}${tier.name}`;
  let targetRole = roles.find((role) => role.name === expectedName);

  if (!targetRole) {
    const createResponse = await discordRequest(`/guilds/${config.guildId}/roles`, config.token, {
      method: "POST",
      body: JSON.stringify({
        name: expectedName.slice(0, 100),
        color: Number.parseInt(tier.color.slice(1), 16),
        hoist: false,
        mentionable: false,
        permissions: "0",
      }),
    });
    if (!createResponse?.ok) return false;
    targetRole = (await createResponse.json()) as DiscordRole;
  } else if (targetRole.color !== Number.parseInt(tier.color.slice(1), 16)) {
    const updateResponse = await discordRequest(
      `/guilds/${config.guildId}/roles/${targetRole.id}`,
      config.token,
      {
        method: "PATCH",
        body: JSON.stringify({ color: Number.parseInt(tier.color.slice(1), 16) }),
      }
    );
    if (updateResponse?.ok) targetRole = (await updateResponse.json()) as DiscordRole;
  }

  const oldRoles = roles.filter(
    (role) => !role.managed && role.id !== targetRole!.id && role.name.startsWith(config.prefix)
  );
  await Promise.all(
    oldRoles.map((role) =>
      discordRequest(
        `/guilds/${config.guildId}/members/${discordUserId}/roles/${role.id}`,
        config.token,
        { method: "DELETE" }
      )
    )
  );

  const assignResponse = await discordRequest(
    `/guilds/${config.guildId}/members/${discordUserId}/roles/${targetRole.id}`,
    config.token,
    { method: "PUT" }
  );
  return Boolean(assignResponse?.ok);
}

export async function removeDiscordRatingRoles(discordUserId: string): Promise<boolean> {
  const config = configuration();
  if (!config) return false;

  const roles = await getGuildRoles(config.token, config.guildId);
  if (!roles) return false;
  const managedRatingRoles = roles.filter(
    (role) => !role.managed && role.name.startsWith(config.prefix)
  );
  const responses = await Promise.all(
    managedRatingRoles.map((role) =>
      discordRequest(
        `/guilds/${config.guildId}/members/${discordUserId}/roles/${role.id}`,
        config.token,
        { method: "DELETE" }
      )
    )
  );
  return responses.every((response) => response?.ok || response?.status === 404);
}
