import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";
import { generateQrDataUrl } from "@/lib/qrcode";
import { assessMembership } from "@/lib/memberships";
import { sendMembershipEmail } from "@/lib/email";
import ConfettiBurst from "@/components/confetti-burst";
import type { Membership, MembershipTier } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your pass",
  // A pass is a bearer token. It must never be indexed.
  robots: { index: false, follow: false },
};

// Where Paystack sends the buyer after paying for a membership, and the page
// they return to afterwards to show the QR at a door.
//
// There's no Paystack webhook on this platform — ticket orders are verified on
// their success page — so passes follow the same pattern and verify here.
export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("*")
    .eq("id", id)
    .maybeSingle<Membership>();

  if (!membership) notFound();

  // Unpaid passes are inserted as "cancelled" so they can never be scanned in.
  // Verify with Paystack and activate once the money is confirmed.
  if (membership.status === "cancelled" && !membership.paid_at && membership.reference) {
    try {
      const tx = await verifyTransaction(membership.reference);
      if (tx.status === "success") {
        await supabase
          .from("memberships")
          .update({ status: "active", paid_at: new Date().toISOString() })
          .eq("id", membership.id)
          .is("paid_at", null); // never activate twice
        await sendMembershipEmail({
          to: membership.member_email,
          memberName: membership.member_name,
          qrToken: membership.qr_token,
          credits: membership.credits_total,
          expiresAt: membership.expires_at,
          passId: membership.id,
        }).catch(() => {
          // The pass is valid whether or not the email lands; this page is the
          // authoritative copy.
        });
      }
    } catch {
      // Leave it unpaid — refreshing retries, and the buyer sees the pending state.
    }
  }

  const { data: fresh } = await supabase
    .from("memberships")
    .select("*")
    .eq("id", id)
    .single<Membership>();

  const { data: tier } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("id", fresh!.tier_id)
    .maybeSingle<MembershipTier>();

  const { data: organizer } = await supabase
    .from("organizers")
    .select("business_name")
    .eq("id", fresh!.organizer_id)
    .maybeSingle<{ business_name: string }>();

  const state = assessMembership(fresh!);
  const paid = !!fresh!.paid_at;

  if (!paid) {
    return (
      <main className="flex-1 mx-auto w-full max-w-md px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Confirming your payment…</h1>
        <p className="mt-3 text-sm text-neutral-500">
          This usually takes a few seconds. Refresh the page if it doesn&apos;t update — your pass
          appears here as soon as the payment clears.
        </p>
      </main>
    );
  }

  const qr = await generateQrDataUrl(fresh!.qr_token);

  return (
    <main className="flex-1 mx-auto w-full max-w-md px-6 py-12">
      <ConfettiBurst />

      <div className="zv-card overflow-hidden">
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 px-7 py-8 text-white">
          <p className="text-xs font-semibold tracking-widest opacity-90">MEMBERSHIP PASS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{tier?.name ?? "Pass"}</h1>
          <p className="mt-1 text-sm opacity-90">{organizer?.business_name}</p>
        </div>

        <div className="p-7 space-y-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-4xl font-bold text-neutral-900 tabular-nums">
                {state.creditsLeft}
                <span className="text-lg font-semibold text-neutral-400"> / {fresh!.credits_total}</span>
              </p>
              <p className="text-sm text-neutral-500">entries left</p>
            </div>
            <p className="text-sm text-neutral-500">
              Valid until{" "}
              {new Date(fresh!.expires_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Your membership QR code"
            className={`mx-auto h-56 w-56 ${state.usable ? "" : "opacity-25"}`}
          />

          <p className="text-center text-sm text-neutral-500">
            {state.usable
              ? "Show this at the door. One entry per event."
              : "This pass can't be used right now."}
          </p>

          <p className="text-center text-xs text-neutral-400">
            {fresh!.member_name} · {fresh!.member_email}
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Bookmark this page — it&apos;s your pass. We&apos;ve emailed you a copy too.
      </p>
    </main>
  );
}
