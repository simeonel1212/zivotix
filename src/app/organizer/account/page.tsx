import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";
import ProfileForm from "./profile-form";
import EmailForm from "./email-form";
import PasswordForm from "./password-form";

export default async function OrganizerAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/organizer/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single<{ full_name: string | null; email: string }>();

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user.id)
    .single<Organizer>();

  if (!organizer) redirect("/organizer/dashboard");

  // Auth is the source of truth for the email address, and profiles.email is a
  // copy of it. Changing an email in Supabase only takes effect once the new
  // address is confirmed, so the two drift for as long as a confirmation is
  // outstanding — and a stale copy here is what sends a payout notice to an
  // address the organizer mistyped. Reconciling on read means the copy catches
  // up the first time they open this page after confirming, with no webhook.
  if (user.email && profile && profile.email !== user.email) {
    await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Account</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Your details and how you sign in. Your brand name is what buyers see on your events.
        </p>
      </div>

      <ProfileForm
        organizerId={organizer.id}
        profileId={user.id}
        fullName={profile?.full_name ?? ""}
        businessName={organizer.business_name}
      />

      <EmailForm current={user.email ?? ""} />

      <PasswordForm />
    </div>
  );
}
