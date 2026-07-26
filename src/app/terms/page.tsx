import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, SupportLink, LEGAL_ENTITY } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern buying tickets and selling events on Zivotix.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms explain what Zivotix does, what you can expect from us, and what we expect from you. Please read them before you buy a ticket or list an event."
    >
      <Section title="1. Who we are">
        <p>
          Zivotix is a ticketing platform operated by {LEGAL_ENTITY} (&quot;Zivotix,&quot; &quot;we,&quot;
          &quot;us&quot;). We let event organizers list events and sell tickets, and we let buyers
          anywhere in the world discover and pay for them.
        </p>
        <p>
          By creating an account, listing an event, or buying a ticket you agree to these terms. If you
          don&apos;t agree with them, please don&apos;t use Zivotix.
        </p>
      </Section>

      <Section title="2. Our role in a sale">
        <p>
          Zivotix is a marketplace and payment facilitator, not the event organizer. When you buy a
          ticket, your contract for attending the event is with the organizer who listed it. We are
          responsible for the platform, the checkout, ticket delivery and the payout to the organizer.
          The organizer is responsible for the event itself.
        </p>
        <p>
          Where an event is listed by Zivotix directly, we act as the organizer and these terms apply to
          us in that role too.
        </p>
      </Section>

      <Section title="3. Accounts">
        <p>
          You must give accurate information when you sign up, keep your login credentials to yourself,
          and you are responsible for what happens on your account. You must be old enough to enter a
          binding contract where you live.
        </p>
        <p>
          Buyers do not need an account to purchase a ticket. Tickets are delivered to the email address
          entered at checkout, so it must be one you can actually receive mail at.
        </p>
      </Section>

      <Section title="4. Buying tickets">
        <p>
          Prices are set by the organizer and shown in the event&apos;s own currency. Payments are
          processed by Paystack. Zivotix never sees or stores your full card number.
        </p>
        <p>
          Where an event is priced in a currency Paystack cannot charge directly, we convert the total at
          the live exchange rate at the moment of checkout and charge you in US dollars. The exact amount
          you will be charged, and the currency, are shown before you confirm. Your bank or card issuer may
          apply its own foreign transaction fee, which is outside our control.
        </p>
        <p>
          A ticket is only valid once payment has been confirmed by Paystack. Each ticket carries a unique
          QR code that can be scanned once. Sharing or duplicating a QR code will result in whoever presents
          it second being refused entry.
        </p>
        <p>
          Cancellations and refunds are governed by our{" "}
          <Link href="/refund-policy" className="font-semibold zv-gradient-text">
            Refund Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="5. Selling tickets (organizers)">
        <p>
          As an organizer you are responsible for the legality of your event, for holding any licences or
          permits it requires, for meeting your own tax obligations, and for honouring every ticket sold
          through Zivotix. Your listing must accurately describe the event, the date, the venue and what a
          ticket includes.
        </p>
        <p>
          You grant us permission to display your listing, brand name and uploaded images on Zivotix and in
          related marketing while your event is live.
        </p>
        <p>
          Zivotix deducts a commission from each sale. Your rate is shown in your organizer dashboard and
          will not change for an event that is already on sale without notice to you.
        </p>
      </Section>

      <Section title="6. Payouts">
        <p>
          Payouts are released after an event has taken place, once the window for refunds and chargebacks
          on that event has passed. The net amount is the gross value of confirmed sales less our
          commission.
        </p>
        <p>
          Payouts to Nigerian bank accounts are sent as a Paystack transfer. Payouts to Thai accounts are
          sent by wire, which can take longer and may attract intermediary bank charges we do not control.
          You are responsible for the accuracy of the bank details on your account, and we are not liable
          for funds sent to details you supplied incorrectly.
        </p>
        <p>
          We may withhold or delay a payout where we have a reasonable suspicion of fraud, a high volume of
          refund requests or chargebacks, or an unresolved dispute with attendees.
        </p>
      </Section>

      <Section title="7. Private and unlisted events">
        <p>
          Organizers can mark an event as unlisted. Unlisted events do not appear on the homepage, in
          search results on Zivotix, or in our sitemap, and are reachable only by their direct link.
          Unlisted is not the same as secret: anyone with the link can view and buy. Do not rely on it to
          protect confidential information.
        </p>
      </Section>

      <Section title="8. Community posts">
        <p>
          Organizers can post updates, and ticket holders can like and comment on them. You keep ownership
          of what you post, and you grant us a licence to display it on Zivotix. You are responsible for
          your own content and must not post anything unlawful, hateful, harassing, deceptive, or that
          infringes someone else&apos;s rights.
        </p>
        <p>
          Some tools in the composer use AI to help draft or polish a post. The words that get published
          are yours, and you are responsible for checking them before you post.
        </p>
        <p>We may remove content or restrict an account that breaches this section.</p>
      </Section>

      <Section title="9. Things you may not do">
        <p>
          Don&apos;t list fraudulent or non-existent events. Don&apos;t resell tickets in breach of an
          organizer&apos;s terms. Don&apos;t attempt to avoid our fees by taking a transaction off-platform
          after using Zivotix to find the buyer. Don&apos;t use Zivotix for money laundering, sanctions
          evasion or any other unlawful purpose. Don&apos;t scrape, probe, overload or attempt to gain
          unauthorised access to the platform.
        </p>
        <p>
          We may suspend or close accounts, cancel listings and reverse transactions where we believe this
          section has been breached.
        </p>
      </Section>

      <Section title="10. Suspension and termination">
        <p>
          You can stop using Zivotix at any time. We may suspend or close your account if you breach these
          terms, if we are required to by law or by a payment provider, or to protect other users. Where an
          account is closed with sales outstanding, we will still settle amounts properly owed to you, less
          any refunds, chargebacks and fees.
        </p>
      </Section>

      <Section title="11. Availability">
        <p>
          We work to keep Zivotix online and accurate, but we don&apos;t promise it will be uninterrupted or
          error-free. We may change, suspend or withdraw features, and we rely on third parties (Paystack,
          Supabase, Resend, Vercel) whose own outages can affect the service.
        </p>
      </Section>

      <Section title="12. Limitation of liability">
        <p>
          Nothing in these terms limits liability that cannot be limited by law, including for fraud or for
          death or personal injury caused by negligence.
        </p>
        <p>
          Subject to that, we are not liable for an event being cancelled, postponed, relocated or
          misrepresented by an organizer, for indirect or consequential loss, or for loss of profit,
          goodwill or anticipated savings. Our total liability to you for any claim relating to a ticket is
          limited to the amount you paid for that ticket.
        </p>
      </Section>

      <Section title="13. Disputes">
        <p>
          If something has gone wrong, contact us first at <SupportLink subject="Dispute" /> — most issues
          are resolved faster that way than through a bank or a court. These terms are governed by the laws
          of the Federal Republic of Nigeria, and the courts of Nigeria have jurisdiction, without affecting
          any mandatory consumer rights you have where you live.
        </p>
      </Section>

      <Section title="14. Changes to these terms">
        <p>
          We may update these terms. The date at the top of this page shows when they last changed. If a
          change materially affects your rights we will make reasonable efforts to notify account holders.
          Continuing to use Zivotix after a change means you accept the updated terms. The terms in force
          when you bought a ticket are the ones that apply to that purchase.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>
          {LEGAL_ENTITY} · <SupportLink subject="Terms of Service" /> ·{" "}
          <Link href="/contact" className="font-semibold zv-gradient-text">
            contact form
          </Link>
        </p>
      </Section>
    </LegalPage>
  );
}
