import type { Metadata } from "next";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";
import { LEGAL_ENTITY, SUPPORT_EMAIL } from "@/components/legal";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Get in touch with Zivotix about a ticket, a refund, organizing an event, payouts, or a partnership.",
  alternates: { canonical: "/contact" },
};

// Marked up so search engines and assistants can surface the support contact
// point directly, rather than making someone dig for an email address.
const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Zivotix",
  legalName: LEGAL_ENTITY,
  url: "https://zivotix.site",
  email: SUPPORT_EMAIL,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
      availableLanguage: ["English"],
    },
  ],
};

export default function ContactPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />

      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 px-7 py-9 sm:px-10 sm:py-11">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-yellow-400/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-[-6rem] h-56 w-56 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2">
            <ZivotixMark size={26} />
            <span className="font-bold tracking-tight text-white text-base">
              Zivo<span className="zv-gradient-text">tix</span>
            </span>
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Talk to a human
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-600">
            Lost a ticket, chasing a refund, thinking about putting your event on Zivotix? Send us a
            message. We read every one and usually reply within a business day.
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10 items-start">
        <ContactForm />

        <aside className="space-y-4">
          <QuickCard title="Can't find your ticket?" >
            <p>
              Check the spam folder for an email from Zivotix first. If it&apos;s not there, you can pull
              your tickets up yourself with the email address you paid with.
            </p>
            <Link href="/orders" className="zv-btn-secondary mt-3 inline-flex text-sm">
              Find my tickets
            </Link>
          </QuickCard>

          <QuickCard title="Want to sell tickets?">
            <p>
              Setting up an organizer account takes a couple of minutes, and you only pay us when you sell.
            </p>
            <Link href="/organise" className="zv-btn-secondary mt-3 inline-flex text-sm">
              Start organizing
            </Link>
          </QuickCard>

          <QuickCard title="Prefer email?">
            <p>
              Write to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold zv-gradient-text">
                {SUPPORT_EMAIL}
              </a>
              . If your event is in the next 24 hours, put URGENT in the subject line.
            </p>
          </QuickCard>

          <QuickCard title="Company">
            <p>
              Zivotix is operated by {LEGAL_ENTITY}. See our{" "}
              <Link href="/terms" className="font-semibold zv-gradient-text">
                Terms
              </Link>
              ,{" "}
              <Link href="/privacy" className="font-semibold zv-gradient-text">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/refund-policy" className="font-semibold zv-gradient-text">
                Refund Policy
              </Link>
              .
            </p>
          </QuickCard>
        </aside>
      </div>
    </main>
  );
}

function QuickCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="zv-card p-5">
      <h2 className="font-semibold text-sm text-neutral-50">{title}</h2>
      <div className="mt-1.5 text-sm text-neutral-400 leading-relaxed">{children}</div>
    </section>
  );
}
