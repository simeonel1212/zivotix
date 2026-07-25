-- Zivotix database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'organizer', 'door_staff', 'buyer');
create type org_country as enum ('NG', 'TH');
create type event_status as enum ('draft', 'published', 'cancelled');
create type order_status as enum ('pending', 'paid', 'failed', 'refunded', 'expired');
create type ticket_status as enum ('valid', 'used', 'void');
create type payout_status as enum ('pending', 'processing', 'paid', 'failed');

-- ============================================================
-- PROFILES  (1:1 with auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZERS
-- ============================================================
create table organizers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  business_name text not null,
  country org_country not null,               -- NG or TH
  payout_currency text not null,               -- NGN or THB
  commission_rate numeric(5,4) not null default 0.1000, -- 10% platform fee
  is_platform_own boolean not null default false,        -- true = admin's own events, 0% fee
  is_verified boolean not null default false,   -- admin-conferred trust badge, shown wherever the organizer name appears
  bank_account jsonb,                           -- { bank_name, account_number, account_name } (NG)
                                                 -- or { bank_name, swift, account_number, account_name } (TH)
  created_at timestamptz not null default now()
);

create index on organizers(profile_id);

-- ============================================================
-- EVENT STAFF  (door staff assigned to an organizer / event)
-- ============================================================
create table event_staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  organizer_id uuid not null references organizers(id) on delete cascade,
  event_id uuid, -- null = can scan for any of the organizer's events
  created_at timestamptz not null default now(),
  unique (profile_id, organizer_id, event_id)
);

-- ============================================================
-- EVENTS
-- ============================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  venue text,
  city text,
  country org_country not null,
  currency text not null,          -- NGN or THB — the organizer's native pricing currency
  cover_image_url text,
  logo_image_url text,             -- small square logo/badge shown over the cover image
  gallery_image_urls text[] not null default '{}',  -- extra promo photos shown through the event page
  links jsonb not null default '[]',                -- [{label, url}] custom links (WhatsApp, Instagram, ...)
  category text not null default 'other',           -- see src/lib/categories.ts for the fixed list
  starts_at timestamptz not null,
  ends_at timestamptz,
  status event_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index on events(organizer_id);
create index on events(status, starts_at);

alter table event_staff
  add constraint event_staff_event_fk foreign key (event_id) references events(id) on delete cascade;

-- ============================================================
-- TICKET TYPES
-- ============================================================
create table ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,                 -- e.g. "Regular", "VIP", "Early Bird"
  price numeric(12,2) not null,       -- in event.currency
  quantity_total integer not null,
  quantity_sold integer not null default 0,
  max_per_order integer not null default 10,
  sales_start timestamptz,
  sales_end timestamptz,
  created_at timestamptz not null default now(),
  check (quantity_sold <= quantity_total)
);

create index on ticket_types(event_id);

-- ============================================================
-- ORDERS  (one buyer checkout, may cover multiple ticket types)
-- ============================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  buyer_name text not null,
  buyer_email text not null,
  buyer_country text,                     -- free text, e.g. "US", "AU", "NG"
  base_currency text not null,            -- event.currency (what organizer is owed in)
  base_amount numeric(12,2) not null,     -- total in base_currency
  charge_currency text not null,          -- currency actually charged to buyer via Paystack (NGN or USD)
  charge_amount numeric(12,2) not null,   -- total in charge_currency
  fx_rate_used numeric(18,8),             -- base_currency -> charge_currency rate at time of purchase
  paystack_reference text unique,         -- our own reference sent to whichever provider processed this order
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  payment_provider text not null default 'paystack' check (payment_provider in ('paystack', 'flutterwave')),
  provider_charge_id text                 -- Flutterwave's chg_xxx id (needed for refunds); null for Paystack orders
);

create index on orders(event_id);
create index on orders(status);
create index on orders(paystack_reference);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  ticket_type_id uuid not null references ticket_types(id),
  quantity integer not null,
  unit_price numeric(12,2) not null,   -- in base_currency
  subtotal numeric(12,2) not null
);

create index on order_items(order_id);

-- ============================================================
-- TICKET RESERVATION (prevents overselling under concurrent checkouts)
-- ============================================================
-- Capacity is reserved atomically at checkout time (before the buyer pays),
-- not just counted after payment succeeds. Two buyers racing for the last
-- tickets can't both pass an "enough left" check the way a plain read/write
-- from application code could race.
create or replace function reserve_ticket_types(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_ticket_type_id uuid;
  v_quantity integer;
  v_updated integer;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_ticket_type_id := (item->>'ticket_type_id')::uuid;
    v_quantity := (item->>'quantity')::integer;

    update ticket_types
    set quantity_sold = quantity_sold + v_quantity
    where id = v_ticket_type_id
      and quantity_sold + v_quantity <= quantity_total;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'SOLD_OUT:%', v_ticket_type_id;
    end if;
  end loop;
end;
$$;

-- Counterpart to reserve_ticket_types: releases capacity back. Used both for
-- immediate rollback (e.g. Paystack init fails right after reserving) and by
-- release_expired_orders below.
create or replace function release_ticket_types(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_ticket_type_id uuid;
  v_quantity integer;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_ticket_type_id := (item->>'ticket_type_id')::uuid;
    v_quantity := (item->>'quantity')::integer;
    update ticket_types
    set quantity_sold = greatest(0, quantity_sold - v_quantity)
    where id = v_ticket_type_id;
  end loop;
end;
$$;

-- Lazy cleanup: someone who starts checkout but never pays would otherwise
-- hold their reserved seats forever. Called at the top of every checkout
-- attempt for the event, so abandoned reservations older than p_minutes are
-- released back into availability before the new reservation is attempted.
create or replace function release_expired_orders(p_event_id uuid, p_minutes integer default 20)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select oi.ticket_type_id, oi.quantity
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.event_id = p_event_id
      and o.status = 'pending'
      and o.created_at < now() - make_interval(mins => p_minutes)
  loop
    update ticket_types
    set quantity_sold = greatest(0, quantity_sold - r.quantity)
    where id = r.ticket_type_id;
  end loop;

  update orders
  set status = 'expired'
  where event_id = p_event_id
    and status = 'pending'
    and created_at < now() - make_interval(mins => p_minutes);
end;
$$;

revoke all on function reserve_ticket_types(jsonb) from public;
revoke all on function release_ticket_types(jsonb) from public;
revoke all on function release_expired_orders(uuid, integer) from public;
grant execute on function reserve_ticket_types(jsonb) to service_role;
grant execute on function release_ticket_types(jsonb) to service_role;
grant execute on function release_expired_orders(uuid, integer) to service_role;

-- ============================================================
-- TICKETS  (one row per physical ticket, generated after payment)
-- ============================================================
create table tickets (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  event_id uuid not null references events(id),
  ticket_type_id uuid not null references ticket_types(id),
  qr_token text not null unique,        -- signed random token encoded into the QR
  attendee_name text,
  status ticket_status not null default 'valid',
  checked_in_at timestamptz,
  checked_in_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index on tickets(event_id);
create index on tickets(qr_token);

-- ============================================================
-- PAYOUTS  (either a manual weekly organizer-wide run, or an automatic
-- per-event payout created by the daily cron a day after the event ends —
-- event_id is null for the former, set for the latter)
-- ============================================================
create table payouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers(id),
  event_id uuid references events(id),     -- set for automatic per-event payouts, null for manual weekly runs
  period_start timestamptz not null,
  period_end timestamptz not null,
  gross_sales numeric(14,2) not null,      -- in organizer's payout_currency
  platform_fee numeric(14,2) not null,     -- what the organizer's payout is reduced by (commission_rate applied to gross)
  net_payable numeric(14,2) not null,      -- what actually gets paid to the organizer — never touched by processor fees
  processor_fee_estimate numeric(14,2),    -- informational only: est. Paystack/Flutterwave cut already taken before this
                                            -- money reached the platform account — shows real platform margin, doesn't
                                            -- change net_payable (see src/lib/processor-fees.ts)
  currency text not null,                  -- organizer.payout_currency
  fx_rate_used numeric(18,8),              -- if a conversion back to payout_currency was needed
  status payout_status not null default 'pending',
  reference text,
  paid_at timestamptz,
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on payouts(event_id);

create index on payouts(organizer_id);
create index on payouts(status);

create table payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references payouts(id) on delete cascade,
  order_id uuid not null references orders(id),
  amount numeric(14,2) not null   -- contribution to gross_sales, in payout currency
);

-- ============================================================
-- EXCHANGE RATE CACHE (optional, avoids hammering the FX API)
-- ============================================================
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null,
  to_currency text not null,
  rate numeric(18,8) not null,
  fetched_at timestamptz not null default now(),
  unique (from_currency, to_currency, fetched_at)
);

-- ============================================================
-- HELPER: auto-create profile row on signup
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    -- raw_user_meta_data is fully client-controlled at signup, so 'admin' is
    -- stripped here — otherwise anyone could register straight into the admin
    -- role. Legitimate flows only ever send 'organizer' (public signup),
    -- 'buyer' (community magic link), or 'door_staff' (staff invite).
    coalesce(
      nullif(new.raw_user_meta_data->>'role', 'admin')::public.user_role,
      'buyer'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- HELPER: block role self-escalation
-- profiles_self_update below has no WITH CHECK clause, so Postgres falls back
-- to its USING clause — which constrains WHICH row you may update, but not
-- WHAT you may set it to. Without this trigger any signed-in user could set
-- their own role to 'admin'. A WITH CHECK subquery against profiles would
-- recurse (same reason is_admin() exists), so it's enforced here instead.
-- ============================================================
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the service role (trusted server-side paths like
  -- staff invites and the payout cron), which bypasses RLS anyway.
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ============================================================
-- HELPER: admin check used by RLS policies below.
-- security definer + explicit search_path means this bypasses RLS when it
-- queries profiles internally — required to avoid infinite recursion, since
-- a plain "exists (select ... from profiles ...)" inside a policy ON
-- profiles would otherwise re-trigger that same policy forever.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table organizers enable row level security;
alter table event_staff enable row level security;
alter table events enable row level security;
alter table ticket_types enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table tickets enable row level security;
alter table payouts enable row level security;
alter table payout_items enable row level security;

-- profiles: user sees/edits own row; admin sees all
create policy "profiles_self" on profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);
create policy "profiles_admin_all" on profiles for all using (public.is_admin());
-- lets an organizer read the profile (name/email) of anyone registered as
-- their own door staff — without this, the embedded profiles(...) join in
-- the staff list silently drops rows the viewer can't read.
create policy "profiles_visible_to_employing_organizer" on profiles for select using (
  exists (
    select 1 from event_staff es
    join organizers o on o.id = es.organizer_id
    where es.profile_id = profiles.id and o.profile_id = auth.uid()
  )
);

-- event_staff: RLS was enabled on this table but no policies were ever
-- defined, so nobody (besides the service role) could read or write it
-- through the normal client — organizers could add staff via the
-- service-role API route but the row was invisible everywhere else.
create policy "event_staff_owner_all" on event_staff for all using (
  exists (select 1 from organizers o where o.id = event_staff.organizer_id and o.profile_id = auth.uid())
  or public.is_admin()
) with check (
  exists (select 1 from organizers o where o.id = event_staff.organizer_id and o.profile_id = auth.uid())
  or public.is_admin()
);
create policy "event_staff_self_select" on event_staff for select using (
  profile_id = auth.uid()
);

-- organizers: owner (via profile_id) + admin
create policy "organizers_owner" on organizers for select using (
  profile_id = auth.uid() or public.is_admin()
);
-- lets a newly signed-up user create their own organizer row (self-serve signup)
create policy "organizers_owner_insert" on organizers for insert with check (profile_id = auth.uid());
create policy "organizers_owner_write" on organizers for update using (profile_id = auth.uid());
create policy "organizers_admin_all" on organizers for all using (public.is_admin());

-- events: public can read published events; organizer manages own; admin manages all
create policy "events_public_read" on events for select using (status = 'published');
create policy "events_owner_all" on events for all using (
  exists (
    select 1 from organizers o
    where o.id = events.organizer_id and o.profile_id = auth.uid()
  )
);
create policy "events_admin_all" on events for all using (
  public.is_admin()
);

-- ticket_types: public can read for published events; organizer manages own
create policy "ticket_types_public_read" on ticket_types for select using (
  exists (select 1 from events e where e.id = ticket_types.event_id and e.status = 'published')
);
create policy "ticket_types_owner_all" on ticket_types for all using (
  exists (
    select 1 from events e
    join organizers o on o.id = e.organizer_id
    where e.id = ticket_types.event_id and o.profile_id = auth.uid()
  )
);

-- orders / order_items / tickets: organizer sees own event's orders; admin sees all.
-- Buyers never query these tables directly — checkout + lookup happen via server routes (service role).
create policy "orders_owner_read" on orders for select using (
  exists (
    select 1 from events e join organizers o on o.id = e.organizer_id
    where e.id = orders.event_id and o.profile_id = auth.uid()
  )
);
create policy "orders_admin_all" on orders for all using (
  public.is_admin()
);

create policy "order_items_owner_read" on order_items for select using (
  exists (
    select 1 from orders ord
    join events e on e.id = ord.event_id
    join organizers o on o.id = e.organizer_id
    where ord.id = order_items.order_id and o.profile_id = auth.uid()
  )
);

create policy "tickets_owner_read" on tickets for select using (
  exists (
    select 1 from events e join organizers o on o.id = e.organizer_id
    where e.id = tickets.event_id and o.profile_id = auth.uid()
  )
);
-- door staff can read + update (check-in) tickets for events they're assigned to
create policy "tickets_staff_read" on tickets for select using (
  exists (
    select 1 from event_staff es
    where es.profile_id = auth.uid()
      and (es.event_id = tickets.event_id or es.event_id is null)
  )
);
create policy "tickets_staff_checkin" on tickets for update using (
  exists (
    select 1 from event_staff es
    where es.profile_id = auth.uid()
      and (es.event_id = tickets.event_id or es.event_id is null)
  )
);
-- organizer can check in tickets for their own events directly, without needing a door_staff row
create policy "tickets_owner_checkin" on tickets for update using (
  exists (
    select 1 from events e join organizers o on o.id = e.organizer_id
    where e.id = tickets.event_id and o.profile_id = auth.uid()
  )
);
-- admin sees + can check in every ticket, matching admin access on every other table
create policy "tickets_admin_all" on tickets for all using (public.is_admin());

-- payouts: organizer reads own; only admin writes
create policy "payouts_owner_read" on payouts for select using (
  exists (select 1 from organizers o where o.id = payouts.organizer_id and o.profile_id = auth.uid())
);
create policy "payouts_admin_all" on payouts for all using (
  public.is_admin()
);
create policy "payout_items_admin_all" on payout_items for all using (
  public.is_admin()
);

-- ============================================================
-- ORGANIZER COMMUNITY (posts + reactions + comments)
-- Posts (text + up to 6 photos) are publicly readable by anyone — a
-- discovery/marketing surface, shown on the homepage and /community.
-- Reacting and commenting stay gated: only people who've ever gotten a
-- ticket from that organizer (paid OR free — orders.status='paid' covers
-- both, since free checkout marks the order 'paid' immediately) can do
-- either. Access for buyers is enforced entirely through service-role API
-- routes (see /api/community/*), matching the existing house convention
-- that buyers never query orders/tickets directly via RLS. RLS here only
-- needs to cover the organizer's own dashboard (posting + moderating).
-- ============================================================

create table organizer_posts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers(id) on delete cascade,
  body text not null,
  image_urls text[] not null default '{}', -- up to 6, enforced client + server side
  created_at timestamptz not null default now()
);

create index on organizer_posts(organizer_id, created_at desc);

create table post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references organizer_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  unique (post_id, profile_id)
);

create index on post_reactions(post_id);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references organizer_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index on post_comments(post_id, created_at);

alter table organizer_posts enable row level security;
alter table post_reactions enable row level security;
alter table post_comments enable row level security;

create policy "organizer_posts_owner_all" on organizer_posts for all using (
  exists (select 1 from organizers o where o.id = organizer_posts.organizer_id and o.profile_id = auth.uid())
  or public.is_admin()
) with check (
  exists (select 1 from organizers o where o.id = organizer_posts.organizer_id and o.profile_id = auth.uid())
  or public.is_admin()
);

-- organizer can see the reaction counts/who-reacted on their own posts
create policy "post_reactions_owner_read" on post_reactions for select using (
  exists (
    select 1 from organizer_posts p
    join organizers o on o.id = p.organizer_id
    where p.id = post_reactions.post_id and o.profile_id = auth.uid()
  )
  or public.is_admin()
);
create policy "post_reactions_admin_all" on post_reactions for all using (public.is_admin());

-- organizer can read + moderate (delete) comments on their own posts
create policy "post_comments_owner_all" on post_comments for all using (
  exists (
    select 1 from organizer_posts p
    join organizers o on o.id = p.organizer_id
    where p.id = post_comments.post_id and o.profile_id = auth.uid()
  )
  or public.is_admin()
);
