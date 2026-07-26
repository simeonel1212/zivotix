import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import { EVENT_CATEGORIES } from "@/lib/categories";

// Regenerated hourly so newly published events get discovered without
// waiting on a redeploy.
export const revalidate = 3600;

// Uses the service-role client rather than the cookie-bound one: sitemap
// generation has no request/cookie context to read from, and everything
// listed here is public anyway.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const service = createServiceClient();

  const { data: events } = await service
    .from("events")
    .select("slug, created_at, starts_at")
    .eq("status", "published")
    .eq("is_unlisted", false); // never expose private events to search engines

  const { data: organizers } = await service.from("organizers").select("id");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/events`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/community`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/organise`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refund-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = EVENT_CATEGORIES.map((c) => ({
    url: `${base}/events?category=${c.value}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${base}/events/${e.slug}`,
    lastModified: new Date(e.created_at),
    changeFrequency: "weekly",
    // Upcoming events matter more than ones that have already happened.
    priority: new Date(e.starts_at) > new Date() ? 0.9 : 0.4,
  }));

  const organizerRoutes: MetadataRoute.Sitemap = (organizers ?? []).map((o) => ({
    url: `${base}/community/${o.id}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...eventRoutes, ...organizerRoutes];
}
