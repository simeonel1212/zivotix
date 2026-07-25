import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack";
import type { Organizer, Payout } from "@/lib/types";

// Pays a pending payout via a real Paystack transfer — only possible for
// Nigerian organizers who have a verified bank account on file. Thai
// organizers (and any NG organizer without bank details saved) still go
// through the manual "Mark paid" form for a wire logged outside the app.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const service = createServiceClient();

  const { data: payout } = await service.from("payouts").select("*").eq("id", id).single<Payout>();
  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  if (payout.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const { data: organizer } = await service
    .from("organizers")
    .select("*")
    .eq("id", payout.organizer_id)
    .single<Organizer>();
  if (!organizer) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });

  if (organizer.country !== "NG" || !organizer.bank_account?.account_number || !organizer.bank_account?.bank_code) {
    return NextResponse.json(
      { error: "No verified Nigerian bank account on file. Use Mark paid to log a manual transfer instead." },
      { status: 400 }
    );
  }

  try {
    // Reuse the cached recipient_code from a previous payout if we have one,
    // otherwise create it now and cache it for next time.
    let recipientCode = organizer.bank_account.recipient_code;
    if (!recipientCode) {
      const recipient = await createTransferRecipient({
        name: organizer.business_name,
        account_number: organizer.bank_account.account_number,
        bank_code: organizer.bank_account.bank_code,
      });
      recipientCode = recipient.recipient_code;
      await service
        .from("organizers")
        .update({ bank_account: { ...organizer.bank_account, recipient_code: recipientCode } })
        .eq("id", organizer.id);
    }

    const amountKobo = Math.round(payout.net_payable * 100);
    const reference = `payout_${payout.id}_${Date.now()}`;

    const transfer = await initiateTransfer({
      recipient_code: recipientCode,
      amount: amountKobo,
      reason: `Zivotix payout: ${organizer.business_name}`,
      reference,
    });

    if (transfer.status === "success") {
      await service
        .from("payouts")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: user.id, reference: transfer.reference })
        .eq("id", id);
      return NextResponse.json({ ok: true, status: "paid" });
    }

    if (transfer.status === "otp") {
      // OTP confirmation is enabled in Paystack Preferences → Transfers, so
      // this transfer needs a code entered in the Paystack dashboard before
      // it actually sends. Record the reference so the webhook can finalize
      // status once it's approved there.
      await service.from("payouts").update({ status: "processing", reference: transfer.reference }).eq("id", id);
      return NextResponse.json({
        ok: true,
        status: "otp",
        message:
          "Transfer created but needs OTP confirmation in the Paystack dashboard (Transfers) before it sends. Disable OTP confirmation in Paystack Preferences to skip this step next time.",
      });
    }

    // "pending" — Paystack is processing it; the webhook will flip this to
    // paid/failed once it resolves.
    await service.from("payouts").update({ status: "processing", reference: transfer.reference }).eq("id", id);
    return NextResponse.json({ ok: true, status: "processing" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Transfer failed" }, { status: 500 });
  }
}
