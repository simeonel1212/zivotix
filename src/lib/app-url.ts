// Single source of truth for the app's own base URL, used everywhere we
// build an absolute link (ticket QR payloads, email links, checkout
// redirects, Supabase magic link redirect_to). Always strips a trailing
// slash so `${appUrl()}/scan` never accidentally becomes a double slash
// (which would fail to match Supabase's exact-match redirect URL allow list).
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "https://zivotix.site";
  return raw.replace(/\/+$/, "");
}
