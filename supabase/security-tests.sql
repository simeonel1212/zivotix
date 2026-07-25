-- ============================================================
-- SECURITY REGRESSION TESTS
-- ============================================================
-- Run after any change to RLS policies, the profiles table, or the signup
-- trigger:
--
--   Supabase dashboard -> SQL Editor -> paste this whole file -> Run
--
-- The script creates a throwaway auth user, attacks it the way a hostile
-- client actually would, then deletes it again. It is safe to run against
-- production, and only meaningful there, since RLS is the thing under test.
--
-- Tests 1 and 2 correspond to two real critical vulnerabilities that existed
-- in this codebase and were fixed on 2026-07-25: any signed-in user could set
-- their own role to 'admin', and anyone could register directly as admin by
-- passing role in signup metadata. Admin means access to every organizer's
-- bank details and the ability to trigger real Paystack transfers, so these
-- must never regress.
-- ============================================================

create temporary table if not exists sec_results (line text);
truncate sec_results;

do $$
declare
  test_user uuid := '00000000-0000-4000-a000-00000000dead';
  r public.user_role;
  failures int := 0;
begin
  -- Clean slate in case a previous run aborted midway.
  delete from auth.users where id = test_user;

  -- --------------------------------------------------------
  -- TEST 1: signup metadata must not be able to grant admin.
  -- raw_user_meta_data is fully client-controlled, so this is exactly what
  -- supabase.auth.signUp({ options: { data: { role: 'admin' } } }) sends.
  -- --------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (test_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'security-test@zivotix.invalid', '{"role":"admin"}'::jsonb, now(), now());

  select role into r from public.profiles where id = test_user;
  if r = 'admin' then
    failures := failures + 1;
    insert into sec_results values ('FAIL 1: signup metadata granted admin');
  else
    insert into sec_results values ('PASS 1: signup metadata cannot grant admin (got ' || r || ')');
  end if;

  -- --------------------------------------------------------
  -- TEST 2: a signed-in non-admin must not be able to promote themselves.
  -- profiles_self_update has no WITH CHECK clause, so Postgres falls back to
  -- its USING clause, which constrains WHICH row is updated but not WHAT it
  -- is set to. The actual guard is the prevent_role_self_escalation trigger.
  -- --------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', test_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  update public.profiles set role = 'admin' where id = test_user;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  select role into r from public.profiles where id = test_user;
  if r = 'admin' then
    failures := failures + 1;
    insert into sec_results values ('FAIL 2: user escalated themselves to admin');
  else
    insert into sec_results values ('PASS 2: self-escalation blocked (role stayed ' || r || ')');
  end if;

  -- --------------------------------------------------------
  -- TEST 3: privileged role changes must still work, or the trigger has
  -- over-corrected and the admin UI is silently broken.
  -- --------------------------------------------------------
  update public.profiles set role = 'organizer' where id = test_user;
  select role into r from public.profiles where id = test_user;
  if r <> 'organizer' then
    failures := failures + 1;
    insert into sec_results values ('FAIL 3: privileged role change wrongly blocked');
  else
    insert into sec_results values ('PASS 3: privileged role changes still work');
  end if;

  delete from auth.users where id = test_user;

  if failures > 0 then
    raise exception '% security test(s) FAILED - see the sec_results table', failures;
  end if;
end $$;

-- --------------------------------------------------------
-- TEST 4: the escalation guard trigger must actually be attached.
-- The function existing is not enough if nothing calls it.
-- --------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'profiles_prevent_role_escalation' and not tgisinternal
  ) then
    raise exception 'FAIL 4: profiles_prevent_role_escalation trigger is not attached';
  end if;
  insert into sec_results values ('PASS 4: role escalation trigger is attached');
end $$;

-- --------------------------------------------------------
-- TEST 5: RLS must be enabled on every table holding money, personal data,
-- or access rights. A table with policies but RLS switched off is wide open.
-- --------------------------------------------------------
do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ')
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles','organizers','events','ticket_types','orders','order_items',
      'tickets','payouts','payout_items','event_staff','organizer_posts',
      'post_reactions','post_comments'
    )
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception 'FAIL 5: RLS is disabled on: %', unprotected;
  end if;
  insert into sec_results values ('PASS 5: RLS enabled on all sensitive tables');
end $$;

-- --------------------------------------------------------
-- TEST 6: only published events may be publicly readable, so drafts stay
-- private.
-- --------------------------------------------------------
do $$
declare
  policy_def text;
begin
  select qual::text into policy_def
  from pg_policies
  where schemaname = 'public' and tablename = 'events' and policyname = 'events_public_read';

  if policy_def is null then
    raise exception 'FAIL 6: events_public_read policy is missing';
  end if;
  if policy_def not like '%published%' then
    raise exception 'FAIL 6: events_public_read no longer restricts to published events';
  end if;
  insert into sec_results values ('PASS 6: only published events are publicly readable');
end $$;

select * from sec_results;
