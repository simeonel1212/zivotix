import Link from "next/link";
import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";
import { assessMembership } from "@/lib/memberships";
import type { Membership, MembershipTier } from "@/lib/types";
import TierForm from "./tier-form";
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
  const revenue = paid.reduce((sum, m) => sum + m.base_amount, 0);
  const active = paid.filter((m) => assessMembership(m).usable).length;
  const entriesUsed = paid.reduce((sum, m) => sum + m.credits_used, 0);
  const entriesSold = paid.reduce((sum, m) => sum + m.credits_total, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Memberships</h1>
          <p className="text-sm text-neutral-500 mt-1">
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
          <Stat label="Entries used" value={`${entriesUsed} / ${entriesSold}`} />
          <Stat
            label="Revenue"
            value={`${revenue.toLocaleString()} ${paid[0]?.base_currency ?? ""}`}
          />
        </div>
      )}

      <section>
        <h2 className="font-semibold text-neutral-900 mb-3">Passes on sale</h2>
        {!tiers?.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">
              No passes yet. Create one and it appears on your community page for fans to buy.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tiers.map((t) => (
              <li key={t.id} className="zv-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-2">
                      {t.event_credits} {t.event_credits === 1 ? "entry" : "entries"} · valid{" "}
                      {Math.round(t.validity_days / 30)} months
                      {!t.is_active && " · not on sale"}
                    </p>
                  </div>
                  <p className="font-semibold text-neutral-900 whitespace-nowrap">
                    {t.price.toLocaleString()} {t.currency}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 mb-3">Members</h2>
        {!paid.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">Nobody has bought a pass yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
            {paid.map((m) => {
              const state = assessMembership(m);
              return (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{m.member_name}</p>
                    <p className="text-xs text-neutral-400 truncate">{m.member_email}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900 tabular-nums">
                        {state.creditsLeft} / {m.credits_total}
                      </p>
                      <p className="text-xs text-neutral-400">
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

      <p className="text-xs text-neutral-400">
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
      <p className="text-xl font-bold text-neutral-900 tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}
