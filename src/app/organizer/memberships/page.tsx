import Link from "next/link";
import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";
import { assessMembership } from "@/lib/memberships";
import type { Membership, MembershipTier } from "@/lib/types";
import TierForm from "./tier-form";
import TierRow from "./tier-row";
import RefundMembershipButton from "./refund-membership-button";

export default async function OrganizerMembershipsPage() {
  const { supabase, organizer } = await getCurrentOrganizer("/organizer/memberships");
  if (!organizer) return <NoOrganizerNotice title="Memberships" />;

  const { data: tiers } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false })
    .returns<MembershipTier[]>();

  const { data: members } = await supabase
    .from("memberships")
    .select("*")
    .eq("organizer_id", organizer.id)
    .not("paid_at", "is", null)
    .order("created_at", { ascending: false })
    .returns<Membership[]>();

  const paid = members ?? [];

  // How many people bought each pass. Drives whether a tier can be deleted
  // outright and whether editing needs the "new buyers only" warning.
  const membersByTier = new Map<string, number>();
  for (const m of paid) membersByTier.set(m.tier_id, (membersByTier.get(m.tier_id) ?? 0) + 1);

  const revenue = paid.reduce((sum, m) => sum + m.base_amount, 0);
  const active = paid.filter((m) => assessMembership(m).usable).length;
  const entriesUsed = paid.reduce((sum, m) => sum + m.credits_used, 0);
  // Period passes contribute no entries — there's no number to add.
  const entriesSold = paid.reduce((sum, m) => sum + (m.credits_total ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Memberships</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Sell a set number of entries up front. Members use them at any of your events until the
            pass expires — money in before the night, not after.
          </p>
        </div>
        <TierForm organizerId={organizer.id} defaultCurrency={organizer.payout_currency} />
      </div>

      {paid.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Members" value={String(paid.length)} />
          <Stat label="Still active" value={String(active)} />
          <Stat label="Entries used" value={entriesSold > 0 ? `${entriesUsed} / ${entriesSold}` : String(entriesUsed)} />
          <Stat
            label="Revenue"
            value={`${revenue.toLocaleString()} ${paid[0]?.base_currency ?? ""}`}
          />
        </div>
      )}

      <section>
        <h2 className="font-semibold text-neutral-50 mb-3">Passes on sale</h2>
        {!tiers?.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">
              No passes yet. Create one and it appears on your community page for fans to buy.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tiers.map((t) => (
              <TierRow
                key={t.id}
                tier={t}
                organizerId={organizer.id}
                memberCount={membersByTier.get(t.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-neutral-50 mb-3">Members</h2>
        {!paid.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">Nobody has bought a pass yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {paid.map((m) => {
              const state = assessMembership(m);
              return (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-50 truncate">{m.member_name}</p>
                    <p className="text-xs text-neutral-500 truncate">{m.member_email}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-50 tabular-nums">
                        {state.creditsLeft === null
                          ? "Unlimited"
                          : `${state.creditsLeft} / ${m.credits_total}`}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {state.usable
                          ? `until ${new Date(m.expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                          : state.reason === "spent"
                            ? "all used"
                            : (state.reason ?? "")}
                      </p>
                    </div>
                    {m.status !== "refunded" && !m.payout_id && (
                      <RefundMembershipButton
                        membershipId={m.id}
                        memberName={m.member_name}
                        amount={m.charge_amount}
                        currency={m.charge_currency}
                        creditsUsed={m.credits_used}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Passes don&apos;t apply to events you&apos;ve marked members-excluded — set that per event on{" "}
        <Link href="/organizer/events" className="font-semibold zv-gradient-text">
          your events page
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="zv-card p-4">
      <p className="text-xl font-bold text-neutral-50 tabular-nums">{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}
