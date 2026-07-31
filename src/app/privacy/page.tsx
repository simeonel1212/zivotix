import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, SupportLink, LEGAL_ENTITY } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Zivotix collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information Zivotix collects, why we collect it, who we share it with, and the choices you have."
    >
      <Section title="1. Who controls your data">
        <p>
          {LEGAL_ENTITY}, operator of Zivotix, is the data controller for the information described here.
          For anything in this policy, or to make a request about your data, write to{" "}
          <SupportLink subject="Data request" />.
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          <strong className="text-neutral-50">If you buy a ticket:</strong> your name, email address, the
          tickets and events you bought, the amount and currency charged, the exchange rate applied, and a
          payment reference from Paystack. We also store the unique QR token for each ticket and whether it
          has been scanned.
        </p>
        <p>
          <strong className="text-neutral-50">If you organize events:</strong> your name, email, phone,
          business or brand name, event listings and images you upload, and the bank account details we
          need to pay you.
        </p>
        <p>
          <strong className="text-neutral-50">If you post in a community feed:</strong> the text and images
          you post, and your likes and comments.
        </p>
        <p>
          <strong className="text-neutral-50">Automatically:</strong> basic technical data such as IP
          address, browser type and pages visited, kept for security, fraud prevention and debugging.
        </p>
        <p>
          We never receive or store your full card number, CVV or PIN. Those go directly to Paystack on
          their own hosted checkout page and never touch Zivotix servers.
        </p>
      </Section>

      <Section title="3. Why we use it">
        <p>
          To process your purchase and deliver your ticket; to let organizers check tickets at the door; to
          pay organizers and verify their bank details; to send transactional email such as tickets,
          receipts, password resets and community access links; to detect and prevent fraud, chargebacks
          and abuse; to meet our accounting, tax and legal obligations; and to keep the platform working
          and improve it.
        </p>
        <p>
          Our legal bases are: performing the contract with you (your ticket, your organizer account), our
          legitimate interests (security, fraud prevention, improving the service), and compliance with
          legal obligations (tax and financial records).
        </p>
        <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>
      </Section>

      <Section title="4. What organizers can see">
        <p>
          When you buy a ticket, the organizer of that event can see your name, email address and what you
          bought, so they can run their event and contact you about it. They are separately responsible for
          how they use that information. If an organizer misuses your details, tell us at{" "}
          <SupportLink subject="Organizer data concern" />.
        </p>
      </Section>

      <Section title="5. Who else we share it with">
        <p>We share the minimum necessary with the services that run Zivotix:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-neutral-50">Paystack</strong> — payments, refunds and payouts.
          </li>
          <li>
            <strong className="text-neutral-50">Supabase</strong> — database, authentication and file
            storage.
          </li>
          <li>
            <strong className="text-neutral-50">Resend</strong> — transactional email delivery.
          </li>
          <li>
            <strong className="text-neutral-50">Vercel</strong> — application hosting and logs.
          </li>
          <li>
            <strong className="text-neutral-50">Google (Gemini)</strong> — only the text an organizer
            chooses to send to the AI writing tools. Buyer data is never sent to it.
          </li>
          <li>
            <strong className="text-neutral-50">An exchange rate provider</strong> — we send currency codes
            only, never personal data.
          </li>
        </ul>
        <p>
          We may also disclose data where the law requires it, or to establish or defend a legal claim. If
          Zivotix is ever sold or merged, data may transfer as part of that, and we would notify you.
        </p>
      </Section>

      <Section title="6. International transfers">
        <p>
          Zivotix serves buyers and organizers in several countries, and the providers above operate
          globally, so your data may be processed outside the country you live in. We only use providers
          that offer appropriate safeguards for international transfers.
        </p>
      </Section>

      <Section title="7. How long we keep it">
        <p>
          Account and event data is kept for as long as your account is open. Transaction records are kept
          for at least seven years after the transaction, because tax and accounting law requires it.
          Technical logs are kept for a short period, typically no more than 90 days. Community posts remain
          until you or the organizer delete them.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          Data is encrypted in transit. Access to production data is limited to people who need it.
          Database access is governed by row-level security rules so that one organizer cannot read another
          organizer&apos;s data. No system is perfectly secure, but if a breach ever affects your personal
          data we will notify you and the relevant regulator as required.
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>
          Depending on where you live — including under Nigeria&apos;s NDPA, Thailand&apos;s PDPA and the
          GDPR — you may have the right to access the data we hold about you, correct it, delete it, object
          to or restrict how we use it, receive a copy in a portable format, and withdraw consent where we
          relied on it.
        </p>
        <p>
          Email <SupportLink subject="Data request" /> and we will respond within 30 days. Deleting your
          account does not erase records we are legally required to keep, such as completed transactions.
          You also have the right to complain to your local data protection authority.
        </p>
      </Section>

      <Section title="10. Cookies">
        <p>
          Zivotix uses essential cookies only: they keep you signed in and keep checkout secure. We do not
          use advertising or cross-site tracking cookies, so there is no consent banner to click through.
        </p>
      </Section>

      <Section title="11. Children">
        <p>
          Zivotix is not intended for children under 16, and we do not knowingly collect their data. If you
          believe a child has given us personal information, contact us and we will remove it.
        </p>
      </Section>

      <Section title="12. Changes and contact">
        <p>
          We may update this policy; the date at the top shows when it last changed. Questions or requests:{" "}
          <SupportLink subject="Privacy" /> or the{" "}
          <Link href="/contact" className="font-semibold zv-gradient-text">
            contact form
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
