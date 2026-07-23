export const USER_ROLES = ["user", "admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isDeveloperRole(role: string | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: string | null | undefined) {
  return role === "super_admin";
}

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}
