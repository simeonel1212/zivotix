// Intentionally empty.
//
// This held ChargePreview, which showed "≈ ₦21,773 charged" under the total.
// It existed for one reason: the Paystack account could only collect naira, so
// a ฿535 ticket became a naira figure on the payment screen, and that
// unexplained jump was where buyers stopped and wondered if they were being
// overcharged.
//
// Flutterwave now charges foreign cards in the event's own currency, or in USD
// where it can't collect that currency. The alarming version of the jump is
// gone, and the exact amount is shown on the hosted payment page before any
// card details are entered — so the line was noise on every listing.
//
// Kept as a marker so the reasoning is discoverable. Safe to delete:
//   rm src/components/charge-preview.tsx
export {};
