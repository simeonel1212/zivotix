import type { Membership } from "@/lib/types";

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
  creditsLeft: number;
  /** Why it can't be used, in words a person on a door can act on. */
  reason?: "expired" | "spent" | "cancelled" | "not_started";
}

export function assessMembership(
  membership: Pick<
    Membership,
    "status" | "credits_total" | "credits_used" | "starts_at" | "expires_at"
  >,
  now: Date = new Date()
): MembershipUsability {
  const creditsLeft = Math.max(membership.credits_total - membership.credits_used, 0);

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
  if (creditsLeft <= 0) {
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
