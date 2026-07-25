# Zivotix

A ticketing platform for organizers in Nigeria and Thailand to sell tickets to buyers anywhere in
the world, with weekly payouts handled by a platform admin.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase** — Postgres database, auth, row-level security
- **Paystack** — payment processing (cards, Apple Pay), Nigerian bank transfers for payouts
- **Resend** — ticket delivery emails
- **jsQR** — in-browser camera QR scanning (no app install for door staff)

## Roles

| Role | Access |
|---|---|
| `admin` (you) | `/admin/payouts` — weekly payout run across all organizers |
| `organizer` | `/organizer/*` — create events, set prices/quantities, view sales |
| `door_staff` | `/scan` — camera-based ticket check-in |
| `buyer` | no account needed — guest checkout at `/events` |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` — this creates all tables, the
   `profiles` auto-provisioning trigger, and row-level security policies.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     from Project Settings → API.

### 3. Set up Paystack

1. Create a Paystack account (this can be done from Nigeria — no Stripe needed).
2. Get your test keys from Settings → API Keys & Webhooks. Add them to `.env.local`
   as `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
3. Add a webhook pointing to `https://yourdomain.com/api/paystack/webhook` and select
   the `charge.success` event. In local dev, use a tool like `ngrok` to expose
   `localhost:3000` for testing webhooks.

### 4. Set up email + FX

- `RESEND_API_KEY` / `EMAIL_FROM` — for ticket delivery emails ([resend.com](https://resend.com)).
- `EXCHANGE_RATE_API_KEY` — for live THB → NGN/USD conversion at checkout
  ([exchangerate.host](https://exchangerate.host) or swap the provider in `src/lib/fx.ts`).

### 5. Create your admin account

Sign up normally at `/signup` (this creates an `organizer` account), then in the Supabase
table editor, change that user's row in `profiles.role` to `admin`. From then on you can
visit `/admin/payouts`.

To make your own events keep 100% of sales, set `is_platform_own = true` on your row in
the `organizers` table.

### 6. Run it

```bash
npm run dev
```

## How money moves

1. Buyer checks out on an event → `/api/checkout` creates a `pending` order, converting the
   event's native currency (NGN or THB) into whatever Paystack can charge (NGN or USD) at the
   live rate, and redirects to Paystack.
2. Paystack calls `/api/paystack/webhook` on `charge.success` → order marked `paid`, one
   `tickets` row generated per ticket with a signed random QR token, confirmation email sent
   with QR attachments via Resend.
3. Door staff open `/scan` on their phone, no app — camera reads the QR, hits `/api/scan`,
   which flips the ticket to `used` (or reports `already_used` / `invalid`). Row-level security
   restricts this to staff assigned to that event.
4. Every Wednesday, admin visits `/admin/payouts` and clicks **Run payout** — this totals each
   organizer's paid-but-not-yet-paid-out sales, applies their commission rate (0% for
   `is_platform_own` events), and creates a `payouts` record. The actual bank transfer / wire
   still happens outside the app (Paystack Transfers API for NG, manual wire for TH); use
   **Mark paid** with a reference number once it's sent.

## What's stubbed / needs real credentials before going live

- FX provider in `src/lib/fx.ts` — pick a provider and confirm rate reliability at your volume.
- Nigerian payouts can be automated via `src/lib/paystack.ts`'s transfer functions (recipient
  creation + transfer); Thai payouts are manual wires by design, since Paystack can't send THB.
- Add real event cover images (currently `cover_image_url` is a plain URL field — wire up
  Supabase Storage or another host when building the "upload image" UI).
