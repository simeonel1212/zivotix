import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Zivotix collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Privacy Policy</h1>
      <p className="text-sm text-neutral-400 mt-2">Last updated {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}</p>

      <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
        This is a general template, not legal advice. Nigeria (NDPA) and Thailand (PDPA) both have data
        protection laws with specific requirements. Have this reviewed by a licensed attorney before relying
        on it.
      </div>

      <div className="mt-10 space-y-8 text-neutral-700 leading-relaxed">
        <Section title="1. What we collect">
          <p>
            When you use Zivotix we collect: account details (name, email, phone), event and ticket purchase
            history, and, for organizers, business and bank account details needed to send payouts. We do
            not collect or store your full card number; payments are handled directly by Paystack.
          </p>
        </Section>

        <Section title="2. How we use it">
          <p>
            We use your data to process ticket purchases and payouts, send transactional emails (tickets,
            password resets, receipts), verify bank accounts before sending payouts, prevent fraud, and improve
            the platform. We don&apos;t sell your personal data.
          </p>
        </Section>

        <Section title="3. Who we share it with">
          <p>
            We share the minimum necessary data with the services that power Zivotix: Paystack (payments and
            payouts), Supabase (account and database hosting), Resend (transactional email), and Vercel
            (application hosting). Each of these processes data under their own privacy policies.
          </p>
        </Section>

        <Section title="4. Data retention">
          <p>
            We retain account and transaction records for as long as your account is active and as needed to
            meet accounting, tax, and dispute-resolution obligations after that.
          </p>
        </Section>

        <Section title="5. Your rights">
          <p>
            You can request access to, correction of, or deletion of your personal data by emailing us. Deleting
            your account doesn&apos;t erase records we&apos;re legally required to keep (e.g. transaction
            history for tax purposes).
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Zivotix uses essential cookies to keep you signed in. We don&apos;t currently use third-party
            advertising or tracking cookies.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Questions about this policy or a data request? Email{" "}
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
