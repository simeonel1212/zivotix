import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";
import VerifiedBadge from "@/components/verified-badge";
import VerifyOrganizerButton from "./verify-organizer-button";
import CommissionRateForm from "./commission-rate-form";

export default async function AdminOrganizersPage() {
  const supabase = await createClient();
  const { data: organizers } = await supabase
    .from("organizers")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Organizer[]>();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Organizers</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Every business selling tickets on Zivotix. Verifying one adds a badge next to their name
          across the site. Use it for organizers you&apos;ve actually confirmed are legit. Commission
          is per organizer, so a negotiated rate only affects that one.
        </p>
      </div>

      {(!organizers || organizers.length === 0) ? (
        <div className="zv-card p-10 text-center">
          <p className="text-sm text-neutral-500">No organizers yet.</p>
        </div>
      ) : (
        <div className="zv-card divide-y divide-white/10 overflow-hidden">
          {organizers.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm">
              <div>
                <p className="font-medium text-neutral-100 flex items-center gap-1.5">
                  {o.business_name}
                  {o.is_verified && <VerifiedBadge />}
                </p>
                <p className="text-neutral-500">
                  {o.country} · payouts in {o.payout_currency}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {o.is_platform_own && (
                  <span className="zv-badge bg-yellow-500/15 text-yellow-800">Platform-owned</span>
                )}
                <CommissionRateForm
                  organizerId={o.id}
                  rate={o.commission_rate}
                  isPlatformOwn={o.is_platform_own}
                />
                <VerifyOrganizerButton organizerId={o.id} isVerified={o.is_verified} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
