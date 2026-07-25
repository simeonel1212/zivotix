import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendDoorStaffInviteEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

// Adds a door-staff login for an organizer's event. The staff member does
// NOT need to already have an account — if none exists for the email, we
// create one behind the scenes (no password) and email them a Supabase magic
// link straight into /scan. Clicking it signs them in automatically.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: organizer } = await supabase
    .from("organizers")
    .select("id, business_name")
    .eq("profile_id", user.id)
    .single();
  if (!organizer) return NextResponse.json({ error: "No organizer profile" }, { status: 403 });

  const { email, eventId } = (await req.json()) as { email: string; eventId?: string };
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const service = createServiceClient();
  let { data: profile } = await service
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    // No account yet — create one with no password. The on_auth_user_created
    // trigger picks up user_metadata.role and creates the matching profiles
    // row with role already set to door_staff.
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: "door_staff" },
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "Could not create an account for that email" }, { status: 500 });
    }
    profile = { id: created.user.id, role: "door_staff" };
  } else if (profile.role === "buyer") {
    // Existing account, but keep the promotion for pre-existing buyers.
    // Already an organizer/admin? Leave their higher role alone.
    await service.from("profiles").update({ role: "door_staff" }).eq("id", profile.id);
  }

  const { error } = await service.from("event_staff").insert({
    profile_id: profile.id,
    organizer_id: organizer.id,
    event_id: eventId ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Staff access is already granted at this point — an email failure
  // shouldn't turn into a 500 for the organizer, just log it.
  try {
    let eventTitle: string | null = null;
    if (eventId) {
      const { data: event } = await service.from("events").select("title").eq("id", eventId).single();
      eventTitle = event?.title ?? null;
    }

    // Magic link: clicking it signs them in directly, no password and no
    // separate signup step required. redirectTo must exactly match an entry
    // in Supabase Auth's Redirect URLs allow list, or it silently falls back
    // to the project's Site URL instead of the intended page.
    //
    // Goes through /auth/callback (unprotected by middleware) rather than
    // straight to /scan: the session Supabase hands back arrives as a URL
    // hash fragment, which only the browser can read — middleware runs
    // server-side and would never see it, and would bounce a direct /scan
    // request to /login before the browser got a chance to establish the
    // session. /auth/callback runs client-side first, then forwards to /scan.
    const redirectTo = `${appUrl()}/auth/callback?next=/scan`;
    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkError || !link) throw linkError ?? new Error("Could not generate a sign-in link");

    console.log(`[staff invite] redirectTo=${redirectTo} action_link=${link.properties.action_link}`);

    await sendDoorStaffInviteEmail({
      to: email,
      organizerName: organizer.business_name,
      eventTitle,
      scanUrl: link.properties.action_link,
    });
  } catch (err) {
    console.error(`[staff invite] Email failed for ${email}:`, err);
  }

  return NextResponse.json({ ok: true });
}
