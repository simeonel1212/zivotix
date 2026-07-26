import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, SupportLink } from "@/components/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How refunds work for tickets bought on Zivotix, including cancelled and rescheduled events.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro="When you're entitled to a refund on a Zivotix ticket, how to ask for one, and how long it takes to reach you."
    >
      <Section title="1. The short version">
        <p>
          Tickets are generally non-refundable, because organizers plan capacity and spend money against
          confirmed sales. But if the organizer cancels, if they move the event and you can&apos;t make the
          new date, or if you were charged in error, you get your money back in full.
        </p>
      </Section>

      <Section title="2. When you're entitled to a refund">
        <ul className="list-disc pl-5 space-y-1">
          <li>The event is cancelled and not rescheduled.</li>
          <li>The event is rescheduled or moved to a different venue and you can&apos;t attend.</li>
          <li>You were charged more than once for the same order, or charged in error.</li>
          <li>
            Your ticket was never delivered and we can&apos;t deliver it — for example, a payment went
            through but no valid ticket was issued.
          </li>
          <li>
            The event was materially different from how it was described in the listing, and we agree it
            was misrepresented.
          </li>
        </ul>
      </Section>

      <Section title="3. When you're not">
        <ul className="list-disc pl-5 space-y-1">
          <li>You changed your mind, double-booked, or couldn&apos;t travel.</li>
          <li>You didn&apos;t turn up.</li>
          <li>
            You arrived after doors closed, or were refused entry for breaching the venue&apos;s rules,
            dress code or age policy.
          </li>
          <li>
            You entered the wrong email at checkout and can&apos;t find your ticket. Contact us instead —
            we can resend it, no refund needed.
          </li>
          <li>
            Minor changes to the lineup, running order or start time that don&apos;t change the substance
            of the event.
          </li>
        </ul>
        <p>
          Organizers may offer terms more generous than this, and some do. Check the event listing —
          anything an organizer states there applies in addition to this policy, never less than it.
        </p>
      </Section>

      <Section title="4. Free tickets">
        <p>
          Nothing was charged, so there is nothing to refund. If you can&apos;t attend, please release your
          spot so someone else can take it.
        </p>
      </Section>

      <Section title="5. How to request a refund">
        <p>
          Contact the event organizer first, using the contact details on the event page. They can approve
          most refunds directly.
        </p>
        <p>
          If the organizer doesn&apos;t respond within a reasonable time, or the event was cancelled, email{" "}
          <SupportLink subject="Refund request" /> or use our{" "}
          <Link href="/contact" className="font-semibold zv-gradient-text">
            contact form
          </Link>
          . Include your order reference and the email address you used at checkout. Requests for a
          cancelled event should reach us within 60 days of the original event date.
        </p>
      </Section>

      <Section title="6. How refunds are processed">
        <p>
          Refunds go back through Paystack to the original payment method — the same card or Apple Pay
          wallet you paid with. We can&apos;t send a refund to a different card, to a bank account, or as
          store credit.
        </p>
        <p>
          Paystack typically settles a refund within 5–10 business days once it is initiated. Your own bank
          may take a few days more to show it. A refunded ticket is voided immediately and will not scan at
          the door.
        </p>
      </Section>

      <Section title="7. Currency and exchange rates">
        <p>
          If your ticket was priced in one currency and charged in another, the refund is issued for the
          exact amount that was charged, in the currency it was charged in. Because exchange rates move,
          the amount your bank credits back in your home currency may differ slightly from what left your
          account. That difference is set by your bank, not by us, and we can&apos;t adjust for it.
        </p>
        <p>
          Any foreign transaction fee your card issuer charged is also theirs, not ours, and is usually not
          returned by them.
        </p>
      </Section>

      <Section title="8. Fees on a refund">
        <p>
          When a refund is issued, you get back the full amount you paid, including the Zivotix commission
          on that sale. You are never left short because a sale had to be reversed.
        </p>
        <p>
          Organizers: a refunded sale is removed from your payout for that event. If the payout has already
          been sent, the amount is recovered from your next payout.
        </p>
      </Section>

      <Section title="9. Chargebacks">
        <p>
          Please come to us before disputing a charge with your bank. A refund we process directly is
          usually far quicker than a bank dispute, which can take months.
        </p>
        <p>
          If you raise a chargeback without contacting us first, the ticket is voided while the dispute is
          open and your account may be suspended until it is resolved. Chargebacks raised in bad faith —
          for example, after attending the event — may be contested with evidence including the scan record
          of your ticket.
        </p>
      </Section>

      <Section title="10. Questions">
        <p>
          Email <SupportLink subject="Refund policy" /> and a real person will read it. This policy sits
          alongside our{" "}
          <Link href="/terms" className="font-semibold zv-gradient-text">
            Terms of Service
          </Link>
          , and does not affect any statutory consumer rights you have where you live.
        </p>
      </Section>
    </LegalPage>
  );
}
