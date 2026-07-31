import type { Membership, MembershipTier } from "@/lib/types";

// Rules a membership pass is judged by, in one place so the door, the buyer's
// pass page and the organizer dashboard can never disagree about whether a
// pass is usable.

/**
 * Membership payment references carry their own prefix so the checkout status
 * page can tell a pass purchase from a ticket order by the reference alone,
 * without a database lookup first.
 */
export const MEMBERSHIP_REFERENCE_PREFIX = "zvxm";

export function isMembershipReference(reference: string | null | undefined): boolean {
  return !!reference && reference.startsWith(MEMBERSHIP_REFERENCE_PREFIX);
}

export interface MembershipUsability {
  usable: boolean;
  /** Entries remaining, or null on a period pass where there is no counter. */
  creditsLeft: number | null;
  /** Why it can't be used, in words a person on a door can act on. */
  reason?: "expired" | "spent" | "cancelled" | "not_started";
}

/** True when this pass admits its holder to everything inside its dates. */
export function isUnlimited(
  membership: Pick<Membership, "credits_total">
): boolean {
  return membership.credits_total === null;
}

export function assessMembership(
  membership: Pick<
    Membership,
    "status" | "credits_total" | "credits_used" | "starts_at" | "expires_at"
  >,
  now: Date = new Date()
): MembershipUsability {
  // A period pass has no credit counter at all — null, not zero. Zero would
  // read as "spent" everywhere downstream, which is the exact opposite of
  // unlimited.
  const unlimited = membership.credits_total === null;
  const creditsLeft = unlimited
    ? null
    : Math.max(membership.credits_total! - membership.credits_used, 0);

  // Order matters: a cancelled pass should say cancelled even if it's also
  // expired, because that's the fact the holder needs to hear.
  if (membership.status === "cancelled" || membership.status === "refunded") {
    return { usable: false, creditsLeft, reason: "cancelled" };
  }
  if (new Date(membership.starts_at) > now) {
    return { usable: false, creditsLeft, reason: "not_started" };
  }
  if (new Date(membership.expires_at) < now) {
    return { usable: false, creditsLeft, reason: "expired" };
  }
  if (!unlimited && creditsLeft! <= 0) {
    return { usable: false, creditsLeft: 0, reason: "spent" };
  }
  return { usable: true, creditsLeft };
}

/** Wording shown at the door. Short, because it's read at a glance in the dark. */
export function membershipRefusalMessage(reason: MembershipUsability["reason"]): string {
  switch (reason) {
    case "expired":
      return "Pass expired";
    case "spent":
      return "No entries left";
    case "cancelled":
      return "Pass cancelled";
    case "not_started":
      return "Pass not active yet";
    default:
      return "Pass not valid";
  }
}

export function expiryFromPurchase(validityDays: number, from: Date = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + validityDays);
  return expires;
}

/**
 * Adds whole calendar months, clamped to the end of the target month.
 *
 * setMonth alone is wrong here: 31 January + 1 month gives 3 March, because
 * February has no 31st and JavaScript rolls the overflow forward. A member who
 * joins on the 31st should get the 28th, not a date in the following month —
 * and certainly not one that drifts further every renewal.
 */
export function expiryFromMonths(months: number, from: Date = new Date()): Date {
  const expires = new Date(from);
  const day = expires.getDate();
  expires.setDate(1);
  expires.setMonth(expires.getMonth() + months);
  const lastDay = new Date(expires.getFullYear(), expires.getMonth() + 1, 0).getDate();
  expires.setDate(Math.min(day, lastDay));
  return expires;
}

/** How a pass describes itself, for the buyer and for the door. */
export function membershipShapeLabel(
  tier: Pick<MembershipTier, "kind" | "event_credits" | "validity_months" | "validity_days">
): string {
  if (tier.kind === "period") {
    const m = tier.validity_months ?? Math.max(1, Math.round(tier.validity_days / 30));
    return `Unlimited entry for ${m} ${m === 1 ? "month" : "months"}`;
  }
  const n = tier.event_credits ?? 0;
  return `${n} ${n === 1 ? "event" : "events"}`;
}
