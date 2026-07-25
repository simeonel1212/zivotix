import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern buying tickets and selling events on Zivotix.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Terms of Service</h1>
      <p className="text-sm text-neutral-400 mt-2">Last updated {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}</p>

      <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
        This is a general template, not legal advice. Have it reviewed by a licensed attorney in Nigeria and
        Thailand before relying on it. Event ticketing and payment processing rules differ by country and
        change over time.
      </div>

      <div className="mt-10 space-y-8 text-neutral-700 leading-relaxed">
        <Section title="1. Who we are">
          <p>
            Zivotix is operated by Eden Cloudwave Technology (&quot;Zivotix,&quot; &quot;we,&quot; &quot;us&quot;), a platform that
            lets event organizers in Nigeria and Thailand list and sell tickets, and lets buyers discover and
            purchase them. By creating an account, listing an event, or buying a ticket, you agree to these Terms.
          </p>
        </Section>

        <Section title="2. Accounts">
          <p>
            You must provide accurate information when signing up and are responsible for activity on your
            account. Organizer accounts are responsible for the accuracy of their event listings, ticket
            pricing, and for delivering the event as described.
          </p>
        </Section>

        <Section title="3. Buying tickets">
          <p>
            When you buy a ticket, you&apos;re entering into an agreement directly with the event organizer.
            Zivotix facilitates the transaction and payment but is not the organizer of the event itself.
            Payments are processed by Paystack; Zivotix does not store your full card details. Ticket
            cancellations and refunds are governed by our{" "}
            <a href="/refund-policy" className="font-semibold zv-gradient-text">
              Refund Policy
            </a>
            .
          </p>
        </Section>

        <Section title="4. Selling tickets (organizers)">
          <p>
            Organizers are responsible for the legality of their event, complying with local licensing and tax
            requirements, and honoring tickets sold through Zivotix. Zivotix deducts a commission from each
            sale before paying out the net amount on the schedule described in your organizer dashboard.
            Payouts to Nigerian bank accounts are sent via Paystack transfer; payouts to Thai accounts are sent
            by manual wire.
          </p>
        </Section>

        <Section title="5. Prohibited use">
          <p>
            You may not use Zivotix to list fraudulent events, resell tickets in violation of an organizer&apos;s
            terms, circumvent fees, or engage in money laundering or other unlawful activity. We may suspend or
            terminate accounts that violate this.
          </p>
        </Section>

        <Section title="6. Limitation of liability">
          <p>
            Zivotix is provided &quot;as is.&quot; To the maximum extent permitted by law, we are not liable for
            losses arising from an event being cancelled, postponed, or misrepresented by an organizer, or for
            issues arising from third-party services we rely on (Paystack, Supabase, Resend).
          </p>
        </Section>

        <Section title="7. Changes">
          <p>We may update these Terms from time to time. Continued use of Zivotix after a change means you accept the updated Terms.</p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:support@zivotix.site" className="font-semibold zv-gradient-text">
              support@zivotix.site
            </a>
            .
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
