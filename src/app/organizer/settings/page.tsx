import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";
import BankAccountForm from "./bank-account-form";

export default async function OrganizerSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/organizer/settings");

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user.id)
    .single<Organizer>();

  if (!organizer) redirect("/organizer/dashboard");

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Payout details</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {organizer.country === "NG"
            ? "Add your bank account so weekly payouts can be sent to you automatically via Paystack transfer."
            : "Add your bank details so we know where to send your weekly payout wire. Thai payouts are sent manually, not through Paystack."}
        </p>
      </div>

      <BankAccountForm organizer={organizer} />
    </div>
  );
}
