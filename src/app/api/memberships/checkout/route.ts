import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { computeFees } from "@/lib/fees";
import { startPayment } from "@/lib/start-payment";
import { generateTicketToken } from "@/lib/qrcode";
import { appUrl } from "@/lib/app-url";
import { MEMBERSHIP_REFERENCE_PREFIX, expiryFromPurchase, expiryFromMonths } from "@/lib/memberships";
import type { MembershipTier } from "@/lib/types";

// Buying a membership pass.
//
// Mirrors /api/checkout closely but deliberately does not share it: a ticket
// order reserves inventory against a specific event, and a pass does neither.
// Forcing both through one route would mean branching on every line of a money
// path that currently works.

interface Body {
  tierId: string;
  memberName: string;
  memberEmail: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const supabase = createServiceClient();

  const memberEmail = (body.memberEmail ?? "").trim();
  const memberName = (body.memberName ?? "").trim();

  // Same validation as ticket checkout: the pass is delivered by email, and a
  // pass that can't reach its owner is worse than a failed payment.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(memberEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address, that's where your pass is sent." },
      { status: 400 }
    );
  }
  if (!memberName) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  const { data: tier } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("id", body.tierId)
    .eq("is_active", true)
    .maybeSingle<MembershipTier>();

  if (!tier) {
    return NextResponse.json({ error: "That pass isn't on sale." }, { status: 404 });
  }
  if (tier.price <= 0) {
    // Free passes would need their own fulfilment path; nothing in the product
    // creates one today, so refuse rather than half-handle it.
    return NextResponse.json({ error: "That pass can't be bought right now." }, { status: 400 });
  }

  const fees = computeFees(tier.price, tier.currency, "pass");
  const reference = `${MEMBERSHIP_REFERENCE_PREFIX}${randomUUID().replace(/-/g, "")}`;

  const { data: membership, error: insertError } = await supabase
    .from("memberships")
    .insert({
      tier_id: tier.id,
      organizer_id: tier.organizer_id,
      member_name: memberName,
      member_email: memberEmail,
      // Issued now rather than on payment so the row is complete and the QR is
      // stable; the pass is unusable until status flips to active on payment.
      qr_token: generateTicketToken(),
      // Null on a period pass — there is no counter, only a window.
      credits_total: tier.kind === "period" ? null : tier.event_credits,
      credits_used: 0,
      // Calendar months where the organizer sold months, so "3 months" bought
      // on the 31st ends on the 30th or 28th rather than sliding into the
      // month after.
      expires_at: (tier.validity_months
        ? expiryFromMonths(tier.validity_months)
        : expiryFromPurchase(tier.validity_days)
      ).toISOString(),
      // Not usable until paid. The door checks status, so an abandoned checkout
      // can never be scanned in.
      status: "cancelled",
      reference,
      base_currency: tier.currency,
      base_amount: fees.organizerReceives,
      service_fee: fees.serviceFee,
      // Seeded in the tier's own currency and corrected below, once the
      // processor has actually accepted the charge and told us what it took.
      charge_currency: tier.currency,
      charge_amount: fees.total,
      fx_rate_used: 1,
    })
    .select()
    .single();

  if (insertError || !membership) {
    return NextResponse.json({ error: "Could not start that purchase" }, { status: 500 });
  }

  try {
    const started = await startPayment({
      amount: fees.total,
      currency: tier.currency,
      reference,
      buyer: { email: memberEmail, name: memberName },
      redirectUrl: `${appUrl()}/pass/${membership.id}`,
      title: tier.name,
      meta: { membership_id: membership.id, tier_id: tier.id },
    });

    await supabase
      .from("memberships")
      .update({
        payment_provider: started.provider,
        charge_currency: started.chargeCurrency,
        charge_amount: started.chargeAmount,
        fx_rate_used: started.fxRate,
      })
      .eq("id", membership.id);

    return NextResponse.json({ redirectUrl: started.paymentUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment init failed" },
      { status: 502 }
    );
  }
}
