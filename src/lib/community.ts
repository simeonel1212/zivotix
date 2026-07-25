import { createServiceClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";

// True if this email has ever gotten a ticket (paid OR free — orders.status
// 'paid' covers both, since free checkout marks the order 'paid' immediately)
// for any event under this organizer. This is the single source of truth for
// community access — no separate membership table to keep in sync.
export async function hasCommunityAccess(buyerEmail: string, organizerId: string): Promise<boolean> {
  const service = createServiceClient();

  const { data: orgEvents } = await service.from("events").select("id").eq("organizer_id", organizerId);
  const eventIds = (orgEvents ?? []).map((e) => e.id);
  if (eventIds.length === 0) return false;

  const { count } = await service
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("event_id", eventIds)
    .eq("status", "paid")
    .ilike("buyer_email", buyerEmail);

  return (count ?? 0) > 0;
}

// Passwordless sign-in link into the community feed — mirrors the
// door-staff magic-link pattern exactly: create a no-password account if one
// doesn't exist yet, then generate a one-click sign-in link into the
// unified feed (access to any given organizer's posts is still checked
// per-post there). Caller decides what to do with the link (email it, or
// fail silently); this never checks hasCommunityAccess itself, callers must
// do that check where it matters.
export async function generateCommunityMagicLink(buyerEmail: string): Promise<string> {
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("email", buyerEmail)
    .maybeSingle();

  if (!profile) {
    const { error: createError } = await service.auth.admin.createUser({
      email: buyerEmail,
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    if (createError) throw createError;
  }

  const redirectTo = `${appUrl()}/auth/callback?next=/community`;
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: buyerEmail,
    options: { redirectTo },
  });
  if (linkError || !link) throw linkError ?? new Error("Could not generate a community sign-in link");

  return link.properties.action_link;
}
