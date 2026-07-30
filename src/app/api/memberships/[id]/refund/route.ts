import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refundTransaction } from "@/lib/paystack";
import type { Membership } from "@/lib/types";

// Refunds a membership pass.
//
// Refunding the *whole* charge, including entries already used, is deliberate.
// A partial refund on a part-used pass sounds fairer but is a trap: it needs a
// per-entry valuation nobody agreed to at purchase, and the member will dispute
// it with their bank — where the platform loses by default and pays a
// chargeback fee on top. Whole-or-nothing is defensible and cheap to explain.
//
// The organizer decides. Zivotix is not the counterparty to the member's
// relationship with them, and an organizer who refuses a fair refund will get a
// chargeback, which is a stronger incentive than any policy we could write.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  const { data: membership } = await service
    .from("memberships")
    .select("*")
    .eq("id", id)
    .maybeSingle<Membership>();

  if (!membership) return NextResponse.json({ error: "Pass not found" }, { status: 404 });

  // Authorisation is checked explicitly because this runs on the service role:
  // the caller must own the organizer, or be an admin.
  const { data: organizer } = await service
    .from("organizers")
    .select("id, profile_id")
    .eq("id", membership.organizer_id)
    .maybeSingle<{ id: string; profile_id: string }>();

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  const permitted = organizer?.profile_id === user.id || profile?.role === "admin";
  if (!permitted) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  if (membership.status === "refunded") {
    return NextResponse.json({ error: "Already refunded" }, { status: 409 });
  }
  if (!membership.paid_at || !membership.reference) {
    return NextResponse.json({ error: "That pass was never paid for" }, { status: 400 });
  }

  // Once a pass has been paid out to the organizer, refunding would take money
  // from Zivotix rather than from them. Blocked rather than silently absorbed.
  if (membership.payout_id) {
    return NextResponse.json(
      {
        error:
          "This pass has already been paid out. Contact support to arrange the refund against your next payout.",
      },
      { status: 409 }
    );
  }

  try {
    await refundTransaction(membership.reference);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paystack refused the refund" },
      { status: 502 }
    );
  }

  // Marked refunded only after Paystack accepts. A pass shown as refunded that
  // wasn't is worse than the reverse — the member would be locked out with
  // their money still gone.
  await service.from("memberships").update({ status: "refunded" }).eq("id", membership.id);

  return NextResponse.json({ refunded: true });
}
