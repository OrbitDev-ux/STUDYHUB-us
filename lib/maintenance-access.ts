const MAINTENANCE_ALLOWED_PREFIXES = [
  "/maintenance",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/callback",
  "/api/discord/callback",
  "/developer",
];

export function isMaintenanceAllowedPath(path: string) {
  if (path.startsWith("/api/cron")) return true;
  return MAINTENANCE_ALLOWED_PREFIXES.some((prefix) => (
    path === prefix || path.startsWith(`${prefix}/`)
  ));
}
