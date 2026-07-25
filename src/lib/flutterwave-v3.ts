// Intentionally empty.
//
// This file briefly held a Flutterwave v3 "Standard" hosted-checkout
// integration, added as a workaround for international card payments while
// Paystack had not approved international acceptance on this account.
//
// Paystack approved international cards in July 2026, so the workaround was
// removed rather than left as a second, untested payment rail. Cards (local
// and international) go through Paystack; Flutterwave is used only for Apple
// Pay via the v4 API in src/lib/flutterwave.ts.
//
// Kept as a marker so the decision is discoverable. Safe to delete:
//   rm src/lib/flutterwave-v3.ts
export {};
