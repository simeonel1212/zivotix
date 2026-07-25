# Testing

Two suites, because the risks are in two different places: the maths and
input handling live in TypeScript, but the access-control rules live in the
database.

## Unit tests (money + input handling)

```bash
npm test          # run once
npm run test:watch # re-run on save
```

Uses Node's built-in test runner, so there is nothing to install. Test files
live in `src/lib/__tests__/`.

They import with explicit `.ts` extensions because `node --test` uses real ESM
resolution rather than a bundler. That is why `allowImportingTsExtensions` is
set in `tsconfig.json`.

What's covered:

| Area | Why it matters |
| --- | --- |
| `toSubunit` / `fromSubunit` | Paystack rejects fractional amounts; float maths after an FX conversion routinely produces them |
| `resolveChargeCurrency` | Paystack cannot charge a card in THB, so Thai events must settle in USD |
| `estimateProcessorFee` | Wrong here and your reported margin is fiction |
| Payout maths | Fee and payout must always reconcile back to gross, and never pay an organizer a negative amount |
| `escapeHtml` | Stops an organizer injecting a phishing link into emails sent from the Zivotix domain |
| `sanitizeLinks` | Stops `javascript:` and `data:` URLs becoming real anchors on public event pages |
| Webhook signatures | A loose comparison would let anyone forge "payment succeeded" and mint free tickets |

One test deliberately documents a known open issue: a commission rate below
~4.8% pays the organizer more than an Apple Pay sale actually delivered,
because `net_payable` is calculated off gross rather than net of processor
fees. When that gets fixed, that test should be inverted.

## Security tests (RLS + permissions)

```
supabase/security-tests.sql
```

Paste into the Supabase dashboard SQL Editor and run. It creates a throwaway
auth user, attacks it the way a hostile client would, then deletes it. Safe to
run against production, and only meaningful there, since RLS is what's being
tested.

Run it after any change to RLS policies, the `profiles` table, or the signup
trigger.

Tests 1 and 2 cover two real critical vulnerabilities found and fixed on
2026-07-25:

1. Anyone could register directly as `admin` by passing `role` in signup
   metadata, which is fully client-controlled.
2. Any signed-in user could set their own role to `admin`, because
   `profiles_self_update` has a `USING` clause but no `WITH CHECK`, so
   Postgres fell back to `USING` — which restricts *which* row you update, not
   *what* you set it to.

Admin means access to every organizer's bank details and the ability to
trigger real Paystack transfers. These must never regress.

## What is not covered

Be aware of the gaps rather than assuming green means safe:

- No end-to-end checkout test against live Paystack or Flutterwave
- No tests for the React components or any UI behaviour
- No load or concurrency testing of the ticket reservation path
- Fulfilment (`fulfillOrder`) is not directly tested, only the pieces it uses
