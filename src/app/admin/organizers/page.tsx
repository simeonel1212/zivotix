import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";
import VerifiedBadge from "@/components/verified-badge";
import VerifyOrganizerButton from "./verify-organizer-button";

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
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Organizers</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Every business selling tickets on Zivotix. Verifying one adds a badge next to their name
          across the site. Use it for organizers you&apos;ve actually confirmed are legit.
        </p>
      </div>

      {(!organizers || organizers.length === 0) ? (
        <div className="zv-card p-10 text-center">
          <p className="text-sm text-neutral-400">No organizers yet.</p>
        </div>
      ) : (
        <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
          {organizers.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm">
              <div>
                <p className="font-medium text-neutral-800 flex items-center gap-1.5">
                  {o.business_name}
                  {o.is_verified && <VerifiedBadge />}
                </p>
                <p className="text-neutral-400">
                  {o.country} · payouts in {o.payout_currency} · {(o.commission_rate * 100).toFixed(0)}% fee
                </p>
              </div>
              <div className="flex items-center gap-2">
                {o.is_platform_own && (
                  <span className="zv-badge bg-yellow-100 text-yellow-800">Platform-owned</span>
                )}
                <VerifyOrganizerButton organizerId={o.id} isVerified={o.is_verified} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
