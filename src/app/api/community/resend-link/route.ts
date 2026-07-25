import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hasCommunityAccess, generateCommunityMagicLink } from "@/lib/community";
import { sendCommunityAccessEmail } from "@/lib/email";

// For buyers whose original magic link (sent with their tickets) has
// expired — lets them request a fresh one. Always responds { ok: true }
// regardless of whether the email actually had access, so this can't be used
// to probe which emails have bought tickets from a given organizer.
export async function POST(req: Request) {
  const { email, organizerId } = (await req.json()) as { email?: string; organizerId?: string };
  if (!email || !organizerId) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const allowed = await hasCommunityAccess(email, organizerId);
  if (allowed) {
    try {
      const service = createServiceClient();
      const { data: organizer } = await service
        .from("organizers")
        .select("business_name")
        .eq("id", organizerId)
        .single();
      const communityUrl = await generateCommunityMagicLink(email);
      await sendCommunityAccessEmail({
        to: email,
        organizerName: organizer?.business_name ?? "the organizer",
        communityUrl,
      });
    } catch (err) {
      console.error(`[community resend-link] Failed for ${email}/${organizerId}:`, err);
    }
  }

  return NextResponse.json({ ok: true });
}
