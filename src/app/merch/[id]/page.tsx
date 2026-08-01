import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { paymentSucceeded } from "@/lib/verify-payment";
import { generateQrDataUrl } from "@/lib/qrcode";
import { sendMerchOrderEmail } from "@/lib/email";
import { formatMoney } from "@/lib/currencies";
import ConfettiBurst from "@/components/confetti-burst";
import type { MerchOrder, MerchProduct } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your order",
  // Carries a pickup code, which is a bearer token. Never index it.
  robots: { index: false, follow: false },
};

// Where Paystack returns a merch buyer, and the page they come back to at the
// door to collect.
//
// There's no Paystack webhook on this platform, so — like tickets and passes —
// payment is confirmed here on return.
export default async function MerchOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("merch_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle<MerchOrder>();

  if (!order) notFound();

  const { data: product } = await supabase
    .from("merch_products")
    .select("*")
    .eq("id", order.product_id)
    .maybeSingle<MerchProduct>();

  let status = order.status;

  if (status === "pending" && !order.paid_at && order.reference) {
    try {
      const succeeded = await paymentSucceeded({
        provider: order.payment_provider,
        reference: order.reference,
        chargeAmount: order.charge_amount,
        chargeCurrency: order.charge_currency,
      });
      if (succeeded) {
        // Guarded on paid_at being null so a refresh can't mark it paid twice
        // and, more importantly, can't decrement stock twice.
        const { data: claimed } = await supabase
          .from("merch_orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id)
          .is("paid_at", null)
          .select("id")
          .maybeSingle();

        if (claimed) {
          // Guarded on `claimed` so a refresh can't email the buyer twice.
          // Failure is swallowed: the order is paid whether or not the email
          // lands, and this page is the authoritative copy of it.
          await sendMerchOrderEmail({
            to: order.buyer_email,
            buyerName: order.buyer_name,
            orderId: order.id,
            productName: product?.name ?? "Item",
            quantity: order.quantity,
            size: order.size,
            total: order.charge_amount,
            currency: order.charge_currency,
            fulfilment: order.fulfilment,
            pickupToken: order.pickup_token,
            shippingAddress: order.shipping_address,
          }).catch(() => {});
        }

        if (claimed && product && product.stock !== null) {
          // Stock comes down on payment, not at checkout: reserving it when
          // the form opened would let an abandoned basket hold the last shirt.
          await supabase
            .from("merch_products")
            .update({ stock: Math.max(0, product.stock - order.quantity) })
            .eq("id", product.id);
        }
        status = "paid";
      }
    } catch {
      // Leave it pending — refreshing retries, and the buyer sees that state.
    }
  }

  const paid = status === "paid";
  const qr = paid && order.pickup_token ? await generateQrDataUrl(order.pickup_token) : null;

  return (
    <main className="flex-1 mx-auto w-full max-w-lg px-6 py-12 space-y-6">
      {paid && <ConfettiBurst />}

      <div className="zv-card p-7 text-center space-y-4">
        {!paid ? (
          <>
            <h1 className="zv-h2 text-neutral-50">Waiting for payment</h1>
            <p className="text-sm text-neutral-400">
              If you&apos;ve just paid, refresh this page in a moment. Nothing is charged twice.
            </p>
          </>
        ) : (
          <>
            <p className="zv-eyebrow zv-gradient-text">Order confirmed</p>
            <h1 className="zv-h2 text-neutral-50">
              {order.quantity} × {product?.name ?? "Item"}
              {order.size ? ` · ${order.size}` : ""}
            </h1>
            <p className="text-sm text-neutral-400">
              {formatMoney(order.charge_amount, order.charge_currency)} · receipt sent to{" "}
              {order.buyer_email}
            </p>
          </>
        )}

        {product?.image_urls?.[0] && (
          <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-2xl">
            <Image src={product.image_urls[0]} alt="" fill sizes="160px" className="object-cover" />
          </div>
        )}
      </div>

      {paid && order.fulfilment === "pickup" && qr && (
        <div className="zv-card p-7 text-center space-y-3">
          <h2 className="font-bold text-neutral-50">Show this to collect</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Pickup code" className="mx-auto h-56 w-56 rounded-2xl bg-white p-3" />
          <p className="text-sm text-neutral-400">
            Bring it to the next event and the team will scan it and hand yours over.
          </p>
        </div>
      )}

      {paid && order.fulfilment === "ship" && (
        <div className="zv-card p-7 space-y-2">
          <h2 className="font-bold text-neutral-50">On its way to</h2>
          <p className="text-sm text-neutral-300 whitespace-pre-line">{order.shipping_address}</p>
          {order.shipping_phone && (
            <p className="text-sm text-neutral-500">{order.shipping_phone}</p>
          )}
          <p className="text-xs text-neutral-500 pt-2">
            {order.fulfilled_at
              ? `Posted ${new Date(order.fulfilled_at).toLocaleDateString()}.`
              : "You'll hear from the organizer once it's posted."}
          </p>
        </div>
      )}
    </main>
  );
}
