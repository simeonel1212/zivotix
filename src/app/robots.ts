import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

// Everything buyer-facing is crawlable; everything private or personal is
// not. /t/ is the most important entry here: those are live ticket QR pages
// keyed by a secret token, so they must never end up in a search index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/t/", // individual ticket pages (secret token in the URL)
          "/api/",
          "/organizer/",
          "/admin/",
          "/scan",
          "/checkout/",
          "/orders",
          "/auth/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
