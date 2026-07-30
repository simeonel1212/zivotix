// Organizer vanity handles — zivotix.site/eden.
//
// The route lives at the top level, so a handle can collide with a real page.
// Next.js resolves static routes before dynamic ones, meaning an organizer who
// claimed "events" wouldn't break /events — but they'd have a handle that
// silently never resolves, which is worse than being told no.
//
// This list therefore includes every current top-level route plus words likely
// to become one. Cheap to over-reserve now; expensive to reclaim a handle
// someone has already printed on a flyer.
const RESERVED = new Set([
  // Real routes today
  "events", "event", "community", "organise", "organize", "organizer", "organiser",
  "admin", "login", "signup", "logout", "auth", "scan", "scanner", "scanner-app",
  "checkout", "orders", "order", "pass", "passes", "contact", "terms", "privacy",
  "refund-policy", "refunds", "links", "offline", "api", "t", "icons", "sitemap",
  "robots", "manifest", "_next", "favicon",
  // Likely future routes, and words that would read as official
  "about", "help", "support", "pricing", "blog", "press", "careers", "jobs",
  "dashboard", "settings", "account", "profile", "me", "new", "search", "explore",
  "discover", "app", "download", "install", "zivotix", "official", "team",
  "security", "status", "legal", "cookies", "sitemap.xml", "sell", "tickets",
  "ticket", "membership", "memberships", "member", "gift", "invite", "referral",
]);

/** Turns whatever an organizer typed into a candidate handle. */
export function normaliseHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^[-_]+|[-_]+$)/g, "")
    .slice(0, 30);
}

export interface HandleCheck {
  ok: boolean;
  /** Why not, phrased for the person choosing it. */
  error?: string;
}

export function validateHandle(handle: string): HandleCheck {
  if (handle.length < 3) return { ok: false, error: "At least 3 characters." };
  if (handle.length > 30) return { ok: false, error: "30 characters at most." };
  // Mirrors the database constraint: must start and end with a letter or digit.
  if (!/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(handle)) {
    return {
      ok: false,
      error: "Letters, numbers, hyphens and underscores only, starting and ending with a letter or number.",
    };
  }
  if (RESERVED.has(handle)) return { ok: false, error: "That one's taken by Zivotix. Try another." };
  return { ok: true };
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED.has(handle.toLowerCase());
}
