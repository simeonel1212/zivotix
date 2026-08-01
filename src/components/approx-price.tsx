// Intentionally empty.
//
// This held ApproxPrice, which showed "≈ ₦21,773" next to a price, converted
// into the currency of wherever the viewer happened to be (from the edge geo
// header, not the browser locale).
//
// It made sense while every charge settled in naira: the approximation was the
// amount the card would be billed. Once Flutterwave started charging foreign
// cards in the event's own currency — or in USD where it can't collect that
// currency — the approximation became a third number that appears nowhere in
// the transaction. Not the price the organizer set, not the amount billed.
// A Nigerian looking at a Thai event saw ฿500 ≈ ₦21,773 and was then charged
// about $16.
//
// Listings now show only the currency the organizer priced in, and the exact
// amount is stated on the payment page before any card details are entered.
//
// Kept as a marker so the reasoning is discoverable. Safe to delete:
//   rm src/components/approx-price.tsx
export {};
