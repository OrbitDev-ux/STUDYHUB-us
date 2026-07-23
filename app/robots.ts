import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/homework", "/planner", "/timer", "/wrong-notes", "/report", "/rank", "/profile", "/users", "/developer", "/settings", "/onboarding", "/banned"] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
