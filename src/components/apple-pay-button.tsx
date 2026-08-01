"use client";

import { useEffect, useState } from "react";

// Apple Pay, offered only where it exists.
//
// The check matters more than it looks. An Apple Pay button rendered on
// Android or desktop Chrome is a dead control on the single most important
// screen in the product — the buyer taps it, nothing they recognise happens,
// and they don't try again. So it renders nothing at all unless the browser
// exposes ApplePaySession *and* reports a provisioned card.
//
// Rendered client-side rather than sniffed from the user agent on the server,
// because "is this an Apple device" is the wrong question: a Mac with no cards
// in Wallet can't pay either, and only the browser knows that.
export default function ApplePayButton({
  onPay,
  disabled = false,
  loading = false,
  label = "Pay",
}: {
  onPay: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Trailing text, e.g. an amount. */
  label?: string;
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    try {
      // Not in TypeScript's DOM lib, and absent everywhere except Safari.
      const session = (window as unknown as { ApplePaySession?: { canMakePayments(): boolean } })
        .ApplePaySession;
      setAvailable(Boolean(session?.canMakePayments()));
    } catch {
      // Safari throws here inside some embedded webviews rather than returning
      // false. A thrown check means "no", not "crash the checkout".
      setAvailable(false);
    }
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={onPay}
      disabled={disabled || loading}
      aria-label="Pay with Apple Pay"
      className="w-full h-12 rounded-2xl bg-white text-neutral-900 font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {loading ? (
        "Opening Apple Pay…"
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 12.54c.02-2.02 1.65-2.99 1.72-3.04-0.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.29 2-1.4 2.43-.36 6.02 1 7.99.67.96 1.46 2.04 2.5 2 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.62.63 1.08-.02 1.77-.98 2.43-1.95.77-1.12 1.08-2.2 1.1-2.26-.02-.01-2.11-.81-2.09-3.18zM15.05 6.6c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.19-.51.59-.96 1.53-.84 2.44.88.07 1.79-.45 2.34-1.1z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
