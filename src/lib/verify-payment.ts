import { verifyTransaction } from "@/lib/paystack";
import { verifyFlutterwaveByReference, verificationMatchesOrder } from "@/lib/flutterwave-v3";

// Did this actually get paid?
//
// There is no webhook on this platform: every return page asks the processor
// directly when the buyer lands on it. Now that a purchase can be taken by
// either processor, "ask Paystack" is no longer a complete answer, and each
// return page working that out for itself is how they drift apart.
//
// Both branches verify by *our* reference rather than anything in the query
// string, so a buyer who edits the URL they were redirected to cannot talk
// their way into a ticket.
export async function paymentSucceeded(args: {
  provider: "paystack" | "flutterwave" | null | undefined;
  reference: string;
  /** What we recorded as owed, used to reject an underpayment. */
  chargeAmount: number;
  chargeCurrency: string;
}): Promise<boolean> {
  if (args.provider === "flutterwave") {
    const v = await verifyFlutterwaveByReference(args.reference);
    return verificationMatchesOrder(v, {
      amount: args.chargeAmount,
      currency: args.chargeCurrency,
    });
  }

  const tx = await verifyTransaction(args.reference);
  return tx.status === "success";
}
