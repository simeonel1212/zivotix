import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Orders",
  // Personal surface, nothing here is useful in a search index.
  robots: { index: false, follow: true },
};

// Buyers check out as guests, so their tickets live in their inbox — this
// page tells them exactly where to look and how to get a resend if lost.
export default function OrdersPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-50">My Orders</h1>
      <p className="mt-2 text-neutral-400">Your tickets are delivered by email the moment payment clears.</p>

      <div className="zv-card p-6 sm:p-8 mt-8 space-y-5 text-sm text-neutral-200 leading-relaxed">
        <div>
          <p className="font-semibold text-neutral-50">Where are my tickets?</p>
          <p className="mt-1 text-neutral-400">
            Search your inbox for <span className="font-medium text-neutral-100">&quot;Your tickets&quot;</span> or
            the event name. The email includes each ticket&apos;s QR code and a link to view it online. Check your
            spam folder too.
          </p>
        </div>
        <div>
          <p className="font-semibold text-neutral-50">Can&apos;t find the email?</p>
          <p className="mt-1 text-neutral-400">
            Contact us with the email address you used at checkout and the event name, and we&apos;ll resend your
            tickets.
          </p>
        </div>
        <a href="mailto:support@zivotix.site?subject=Resend my tickets" className="zv-btn-primary inline-flex">
          Email support
        </a>
      </div>
    </main>
  );
}
