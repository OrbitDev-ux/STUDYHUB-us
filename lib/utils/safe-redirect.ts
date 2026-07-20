// 외부로 리다이렉트되는 오픈 리다이렉트를 막기 위해, "/"로 시작하고 "//"(프로토콜
// 상대 URL), "@"(userinfo 트릭), "://"를 포함하지 않는 내부 경로만 허용한다.
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("@") && !path.includes("://");
}

export function safeRedirectPath(value: FormDataEntryValue | string | null, fallback: string): string {
  const path = typeof value === "string" ? value : String(value ?? "");
  return isSafeRedirectPath(path) ? path : fallback;
}
