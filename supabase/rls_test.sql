-- ══════════════════════════════════════════════════════════════════════════════
-- rls_test.sql — proves user A cannot read, update or delete user B's rows
-- (REQ-DB3 / REQ-T1 integration test)
--
-- How to run (either way):
--   A) Dashboard > SQL Editor: run this script — it simulates two users with
--      set local request.jwt.claims.
--   B) With the CLI against a project: supabase db execute --file supabase/rls_test.sql
--
-- Every marked step must return what its comment says; if any check fires
-- `RAISE EXCEPTION`, the migration has a leak and must be fixed first.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Create two real auth users ────────────────────────────────────────────
-- profiles.user_id → auth.users(id) FK: the auth.users row MUST exist first.
-- The on_auth_user_created trigger (handle_new_user, 0001_init.sql) then
-- auto-creates each profile row, so no manual profiles insert is needed.
-- NOTE: run this BEFORE `set local role authenticated`, i.e. as postgres/admin.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'a@example.test', 'x', now(),
        jsonb_build_object('display_name', 'User A')),
       ('22222222-2222-2222-2222-222222222222', 'b@example.test', 'x', now(),
        jsonb_build_object('display_name', 'User B'))
on conflict do nothing;

-- Safety net in case the trigger did not fire (e.g. trigger not yet installed):
insert into public.profiles (user_id, display_name)
values ('11111111-1111-1111-1111-111111111111', 'User A'),
       ('22222222-2222-2222-2222-222222222222', 'User B')
on conflict do nothing;

-- ── 1. Act as USER A: create a learner + learning area ──────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.learners (id, user_id, name, grade)            -- expects 1 row
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A Learner', 6);

insert into public.learning_areas (id, user_id, learner_id, name) -- expects 1 row
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Mathematics');

-- ── 2. Act as USER B: cannot read, update, delete, or write into A's data ────
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare
  c int;
  b_user uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- 2a. B cannot SELECT A's rows
  select count(*) into c from public.learning_areas where user_id <> b_user;
  if c <> 0 then raise exception 'LEAK: B selected A rows'; end if;

  select count(*) into c from public.learners where user_id <> b_user;
  if c <> 0 then raise exception 'LEAK: B selected A learners'; end if;

  -- 2b. B cannot UPDATE A's rows (update affects 0 rows)
  update public.learning_areas set name = 'Hacked' where user_id <> b_user;
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'LEAK: B updated A rows'; end if;

  -- 2c. B cannot DELETE A's rows (delete affects 0 rows)
  delete from public.learning_areas where user_id <> b_user;
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'LEAK: B deleted A rows'; end if;

  -- 2d. B cannot INSERT a row with A's user_id
  --     (WITH CHECK blocks it; the verify_learner_owner BEFORE-INSERT trigger
  --      fires first in this setup and raises P0001 — also a valid block)
  begin
    insert into public.learning_areas (user_id, learner_id, name)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Injected');
    raise exception 'LEAK: B inserted with A user_id';
  exception when check_violation then
    null; -- blocked by RLS WITH CHECK as expected
  when insufficient_privilege then
    null; -- could also surface as this error code
  when raise_exception then
    if sqlerrm like 'learner % does not belong%' then
      null; -- blocked by the ownership trigger before RLS got a chance
    else
      raise; -- unrelated error: not evidence of a block, surface it
    end if;
  end;

  -- 2e. B cannot INSERT a child row referencing A's learner (trigger blocks it)
  begin
    insert into public.learning_areas (learner_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sneaky child');
    raise exception 'LEAK: B inserted child row into A learner';
  exception when others then
    if sqlerrm like 'learner % does not belong%' then null;
    else raise; end if;
  end;

  raise notice 'ALL RLS CHECKS PASSED';
end $$;

rollback;
