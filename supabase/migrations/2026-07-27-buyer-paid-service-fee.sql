-- Move Zivotix's revenue from an organizer-side commission to a buyer-paid
-- service fee.
--
-- Why: the 3% commission was below cost. Paystack takes 1.5% + ₦100 locally
-- (3.8% effective on a ₦5,000 ticket) and 3.9% + ₦100 internationally, both
-- plus VAT. Payouts were computed as gross × (1 − commission) regardless of
-- what the processor actually took, so the difference came out of the
-- platform's own account on every small or international sale.
--
-- After this migration:
--   orders.base_amount   = ticket face value, what the organizer is owed
--   orders.service_fee   = what the buyer paid on top, Zivotix's revenue
--   orders.charge_amount = (base_amount + service_fee), converted to the
--                          charge currency
--   payouts.platform_fee = 0 for new payouts; organizers receive 100%
--
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- The column is nullable-safe (defaults to 0), so existing orders and the
-- currently deployed build keep working while the deploy rolls out.

begin;

alter table orders
  add column if not exists service_fee numeric(12,2) not null default 0;

comment on column orders.service_fee is
  'Buyer-paid Zivotix service fee, in base_currency. Platform revenue. Not part of what the organizer is owed — that is base_amount.';

comment on column orders.base_amount is
  'Ticket face value in base_currency. This is exactly what the organizer is paid; the buyer paid base_amount + service_fee.';

-- Historic orders predate the fee, so 0 is correct for them rather than a
-- backfilled estimate. Revenue on those sales came out of the payout instead
-- and is already recorded in payouts.platform_fee.

comment on column payouts.platform_fee is
  'Legacy commission deducted from the organizer. Zero for payouts created after the switch to buyer-paid service fees (2026-07-27); platform revenue now lives in orders.service_fee.';

-- commission_rate stays on organizers rather than being dropped: it still
-- describes the deal for any payout run covering pre-switch sales, and
-- removing it would rewrite history on existing payout records.
comment on column organizers.commission_rate is
  'Legacy organizer-side commission. No longer applied to new sales — Zivotix charges the buyer a service fee instead. Retained so historic payouts remain explainable.';

commit;
