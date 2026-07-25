import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Event covers, logos, and gallery photos are stored in Supabase
    // Storage. Routing them through next/image means Vercel's image CDN
    // fetches each one from Supabase once, resizes/caches it, and serves
    // every subsequent viewer (and every card thumbnail size) from Vercel's
    // own edge instead of re-hitting Supabase egress on every pageview.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // Event photos rarely change once an organizer sets them up, so cache
    // aggressively (1 day) rather than the 60s default — that's the lever
    // that actually stretches the free tier's 5GB/month egress cap.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
