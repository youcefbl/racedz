import type { MetadataRoute } from "next";

const SITE_URL = "https://zidrun.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/authenticated surfaces and API endpoints stay out of the index.
      disallow: ["/account", "/admin", "/organizer", "/api", "/login", "/register", "/reset-password", "/verify-email"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
