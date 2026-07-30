import Link from "next/link";
import { computeFees } from "@/lib/fees";
import type { MembershipTier } from "@/lib/types";

// A nudge on the event page: this organizer sells passes.
//
// Deliberately not a second checkout. Someone reading an event page is deciding
// about one night; dropping a full purchase form under it competes with the
// ticket they came for. This states the value in one line and sends them to the
// organizer's page to buy.
//
// The comparison is what does the work. "6 nights for ₦40,000 — ₦6,667 a night
// instead of ₦10,000" is an argument. "We sell passes" is not.
export default function MembershipUpsell({
  tiers,
  organizerHref,
  organizerName,
  cheapestTicket,
}: {
  tiers: MembershipTier[];
  /** Where the passes actually live — the vanity link when there is one. */
  organizerHref: string;
  organizerName: string | null;
  /** Lowest paid ticket on this event, for the per-night comparison. */
  cheapestTicket: number | null;
}) {
  if (!tiers.length) return null;

  // Best value per entry, which is the tier worth leading with.
  const best = tiers.reduce((a, b) =>
    a.price / a.event_credits <= b.price / b.event_credits ? a : b
  );
  const perEntry = Math.round((best.price / best.event_credits) * 100) / 100;
  const total = computeFees(best.price, best.currency, "pass").total;
  const saves = cheapestTicket !== null && perEntry < cheapestTicket;

  return (
    <section className="zv-card p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider zv-gradient-text">
            Coming to more than one?
          </p>
          <h2 className="mt-1.5 text-lg font-bold text-neutral-900">
            {best.event_credits} nights for {total.toLocaleString()} {best.currency}
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500 leading-relaxed">
            {saves ? (
              <>
                That&apos;s {perEntry.toLocaleString()} {best.currency} a night instead of{" "}
                {cheapestTicket!.toLocaleString()}. Use the entries at any{" "}
                {organizerName ?? "of this organizer's"} event for the next{" "}
                {Math.round(best.validity_days / 30)} months.
              </>
            ) : (
              <>
                {perEntry.toLocaleString()} {best.currency} a night, used at any{" "}
                {organizerName ?? "of this organizer's"} event for the next{" "}
                {Math.round(best.validity_days / 30)} months.
              </>
            )}
          </p>
        </div>
        <Link href={`${organizerHref}#passes`} className="zv-btn-secondary text-sm shrink-0">
          See passes
        </Link>
      </div>
    </section>
  );
}
