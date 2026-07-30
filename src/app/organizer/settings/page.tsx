import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";
import { payoutMethod, countryLabel } from "@/lib/countries";
import BankAccountForm from "./bank-account-form";
import PayoutCurrencyForm from "./payout-currency-form";
import HandleForm from "./handle-form";

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
          {payoutMethod(organizer.country) === "paystack"
            ? `Add your ${countryLabel(organizer.country)} bank account so weekly payouts reach you automatically by transfer, usually the same day.`
            : `Add your bank details so we know where to send your weekly payout. Payouts to ${countryLabel(organizer.country)} are sent by international wire, which takes two to five business days and may carry intermediary bank fees.`}
        </p>
      </div>

      <HandleForm organizerId={organizer.id} current={organizer.handle ?? null} />

      <BankAccountForm organizer={organizer} />

      <PayoutCurrencyForm
        organizerId={organizer.id}
        current={organizer.payout_currency}
        // Paystack transfers settle into the country's own currency, so there's
        // nothing to choose — the option would just be a dead control.
        disabled={payoutMethod(organizer.country) === "paystack"}
        disabledReason={`Paystack transfers to ${countryLabel(organizer.country)} settle in ${organizer.payout_currency}, so this can't be changed. Get in touch if you'd rather be paid in another currency by international transfer.`}
      />
    </div>
  );
}
