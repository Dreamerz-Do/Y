-- RLS matrix coverage — the admin/destructive cells (spec 4.2).
--
-- The matrix "doubles as the test specification: every row is a test, per role."
-- rls_authorisation_test.sql covers the owner/member cells for settings, invite,
-- roles and group-create, and the item edit/delete/assign rows. This file fills
-- the gaps so every role×action cell is exercised:
--   - guest denials for the owner-only actions (settings, invite, roles, groups)
--   - manage groups: update and delete (not just insert)
--   - assign to another member: the owner/member positive
--   - remove members: owner removes; a member may leave but not remove others; a
--     guest may remove no one
--   - delete board: owner may, member and guest may not
--
-- Each check acts as a real `authenticated` role with a real JWT, so the
-- policies and guard triggers decide the outcome.
--
-- Run locally with:  supabase test db

begin;
select plan(15);

-- ---------------------------------------------------------------------------
-- Fixtures. Board A carries all three roles; board B is a throwaway the owner
-- can delete without disturbing the rest. The owner rows come from the
-- on_board_created trigger; the group is created directly as superuser.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data)
values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@test', now(), now(),
   '{"provider":"email"}', '{"display_name":"Ollie"}'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'member@test', now(), now(),
   '{"provider":"email"}', '{"display_name":"Mees"}'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guest@test', now(), now(),
   '{"provider":"email"}', '{"display_name":"Gijs"}');

insert into public.boards (id, name, created_by)
values
  ('e0000000-0000-0000-0000-0000000000aa', 'Test', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-0000000000bb', 'Tweede', 'e1111111-1111-1111-1111-111111111111');

insert into public.memberships (board_id, user_id, role)
values
  ('e0000000-0000-0000-0000-0000000000aa', 'e2222222-2222-2222-2222-222222222222', 'member'),
  ('e0000000-0000-0000-0000-0000000000aa', 'e3333333-3333-3333-3333-333333333333', 'guest');

insert into public.groups (id, board_id, name)
values ('e0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000aa', 'Ouders');

-- ---------------------------------------------------------------------------
-- Guest denials for the owner-only actions
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
update public.boards set name = 'Hacked' where id = 'e0000000-0000-0000-0000-0000000000aa';
reset role;
select is((select name from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa'),
  'Test', 'a guest cannot change board settings');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
select throws_ok(
  $$insert into public.invitations (board_id, email, invited_by)
    values ('e0000000-0000-0000-0000-0000000000aa', 'x@test',
            'e3333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'a guest cannot create an invitation');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
update public.memberships set role = 'owner'
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e2222222-2222-2222-2222-222222222222';
reset role;
select is((select role::text from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e2222222-2222-2222-2222-222222222222'),
  'member', 'a guest cannot change roles');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
select throws_ok(
  $$insert into public.groups (board_id, name)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Poging')$$,
  '42501', null, 'a guest cannot create a group');

-- ---------------------------------------------------------------------------
-- Assign to another member — owner/member positive (guest denial lives in
-- rls_authorisation_test.sql)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
select lives_ok(
  $$insert into public.items (board_id, title, visibility, created_by, assignee_id)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Voor Ollie', 'board',
            'e2222222-2222-2222-2222-222222222222',
            (select id from public.memberships
             where board_id = 'e0000000-0000-0000-0000-0000000000aa'
               and user_id = 'e1111111-1111-1111-1111-111111111111'))$$,
  'a member can assign an item to another member');

-- ---------------------------------------------------------------------------
-- Manage groups — update and delete (owner yes, member no)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
update public.groups set name = 'Ouders 2' where id = 'e0000000-0000-0000-0000-0000000000c1';
reset role;
select is((select name from public.groups where id = 'e0000000-0000-0000-0000-0000000000c1'),
  'Ouders 2', 'an owner can rename a group');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
update public.groups set name = 'Nope' where id = 'e0000000-0000-0000-0000-0000000000c1';
reset role;
select is((select name from public.groups where id = 'e0000000-0000-0000-0000-0000000000c1'),
  'Ouders 2', 'a member cannot rename a group');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
delete from public.groups where id = 'e0000000-0000-0000-0000-0000000000c1';
reset role;
select is((select count(*)::int from public.groups where id = 'e0000000-0000-0000-0000-0000000000c1'),
  0, 'an owner can delete a group');

-- ---------------------------------------------------------------------------
-- Delete board — owner yes, member and guest no
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
delete from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa';
reset role;
select is((select count(*)::int from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa'),
  1, 'a member cannot delete the board');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
delete from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa';
reset role;
select is((select count(*)::int from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa'),
  1, 'a guest cannot delete the board');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
delete from public.boards where id = 'e0000000-0000-0000-0000-0000000000bb';
reset role;
select is((select count(*)::int from public.boards where id = 'e0000000-0000-0000-0000-0000000000bb'),
  0, 'an owner can delete a board');

-- ---------------------------------------------------------------------------
-- Remove members — a member may not remove another, a guest may remove no one,
-- a member may leave (remove self), an owner may remove anyone.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
delete from public.memberships
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e3333333-3333-3333-3333-333333333333';
reset role;
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e3333333-3333-3333-3333-333333333333'),
  1, 'a member cannot remove another member');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
delete from public.memberships
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e2222222-2222-2222-2222-222222222222';
reset role;
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e2222222-2222-2222-2222-222222222222'),
  1, 'a guest cannot remove a member');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
delete from public.memberships
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e2222222-2222-2222-2222-222222222222';
reset role;
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e2222222-2222-2222-2222-222222222222'),
  0, 'a member can remove themselves (leave)');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
delete from public.memberships
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e3333333-3333-3333-3333-333333333333';
reset role;
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e3333333-3333-3333-3333-333333333333'),
  0, 'an owner can remove a member');

select * from finish();
rollback;
