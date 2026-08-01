// Intentionally empty.
//
// This held ChargePreview, which showed "≈ $15.96" (and at one point
// "≈ ₦21,772.77") under a checkout total — the amount the processor would
// actually bill when it differed from the currency the organizer priced in.
//
// It was written for a real problem: the page said ฿535 and the payment screen
// said something else, and that unexplained jump is where a buyer stops. But
// the answer landed on showing a second number on every listing, and a second
// number is its own kind of noise. The organizer's price is the price; the
// exact charge is stated on the hosted payment page before any card details
// are entered, which is the moment it actually matters.
//
// Kept as a marker so the reasoning is discoverable rather than rediscovered.
// Safe to delete:
//   rm src/components/charge-preview.tsx
export {};
