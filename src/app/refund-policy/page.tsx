import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How refunds work for tickets bought on Zivotix, including cancelled and rescheduled events.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Refund Policy</h1>
      <p className="text-sm text-neutral-400 mt-2">Last updated {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}</p>

      <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
        This is a general template, not legal advice. Consumer protection rules around refunds differ between
        Nigeria and Thailand. Have it reviewed before relying on it.
      </div>

      <div className="mt-10 space-y-8 text-neutral-700 leading-relaxed">
        <Section title="1. General policy">
          <p>
            Tickets purchased on Zivotix are generally non-refundable. Buying a ticket means you&apos;re
            reserving a spot at someone else&apos;s event, and organizers plan capacity and costs around
            confirmed sales. Check the specific event listing for any additional terms the organizer has set.
          </p>
        </Section>

        <Section title="2. When a refund does happen">
          <p>You&apos;re entitled to a refund if:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The event is cancelled by the organizer and not rescheduled.</li>
            <li>The event is rescheduled and you can&apos;t attend the new date.</li>
            <li>You were charged in error (e.g. a duplicate charge).</li>
          </ul>
        </Section>

        <Section title="3. How refunds are processed">
          <p>
            Refunds are issued by the organizer or Zivotix admin back to the original payment method through
            Paystack. Once initiated, Paystack typically settles refunds within 5–10 business days, though your
            bank may take longer to reflect it. A refunded ticket is voided immediately and can no longer be
            scanned at the door.
          </p>
        </Section>

        <Section title="4. Platform fee on refunds">
          <p>
            When a refund is issued, Zivotix refunds the full amount you paid, including its commission on that
            sale. You&apos;re never left short because a sale had to be reversed.
          </p>
        </Section>

        <Section title="5. Requesting a refund">
          <p>
            Contact the event organizer directly through the details on the event page, or email{" "}
            <a href="mailto:support@zivotix.site" className="font-semibold zv-gradient-text">
              support@zivotix.site
            </a>{" "}
            with your order reference if the organizer is unresponsive or the event was cancelled.
          </p>
        </Section>

        <Section title="6. Chargebacks">
          <p>
            If you dispute a charge directly with your bank instead of requesting a refund first, your account
            may be suspended pending resolution. Please reach out to us first, refunds are usually faster than
            a bank dispute.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h2>
      {children}
    </section>
  );
}
