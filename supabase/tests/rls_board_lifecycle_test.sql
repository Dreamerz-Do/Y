-- Board lifecycle tests (spec 4.5): delete_board, leave_board, remove_member.
--
-- Each scenario uses its own board so destructive steps don't interfere. Calls
-- run as a real `authenticated` role with a JWT, so the SECURITY DEFINER
-- functions' own authorisation checks (auth.uid() + role) decide the outcome.
--
-- Run locally with:  supabase test db

begin;
select plan(19);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data)
values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'o1@test', now(), now(), '{"provider":"email"}', '{"display_name":"Ollie"}'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'o2@test', now(), now(), '{"provider":"email"}', '{"display_name":"Otis"}'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'm@test', now(), now(), '{"provider":"email"}', '{"display_name":"Mees"}');

-- Boards (creator becomes owner via the on_board_created trigger).
insert into public.boards (id, name, created_by) values
  ('e0000000-0000-0000-0000-0000000000aa', 'A', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-0000000000bb', 'B', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-0000000000cc', 'C', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-0000000000dd', 'D', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-0000000000ee', 'E', 'e1111111-1111-1111-1111-111111111111');

-- Extra memberships. A has a second owner + a member; C/D/E have a member.
insert into public.memberships (board_id, user_id, role) values
  ('e0000000-0000-0000-0000-0000000000aa', 'e2222222-2222-2222-2222-222222222222', 'owner'),
  ('e0000000-0000-0000-0000-0000000000aa', 'e3333333-3333-3333-3333-333333333333', 'member'),
  ('e0000000-0000-0000-0000-0000000000cc', 'e3333333-3333-3333-3333-333333333333', 'member'),
  ('e0000000-0000-0000-0000-0000000000dd', 'e3333333-3333-3333-3333-333333333333', 'member'),
  ('e0000000-0000-0000-0000-0000000000ee', 'e3333333-3333-3333-3333-333333333333', 'member');

-- Board A items, created by o1: a board item, a private item, and one assigned
-- to the member. (Impersonate o1 so the insert policies and assignment guard run.)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('e0000000-0000-0000-0000-000000000a01', 'e0000000-0000-0000-0000-0000000000aa', 'A board', 'board', 'e1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-000000000a02', 'e0000000-0000-0000-0000-0000000000aa', 'A priv', 'private', 'e1111111-1111-1111-1111-111111111111');
insert into public.items (id, board_id, title, visibility, created_by, assignee_id) values
  ('e0000000-0000-0000-0000-000000000a03', 'e0000000-0000-0000-0000-0000000000aa', 'A assigned', 'board',
   'e1111111-1111-1111-1111-111111111111',
   (select id from public.memberships where board_id = 'e0000000-0000-0000-0000-0000000000aa' and user_id = 'e3333333-3333-3333-3333-333333333333'));

-- Board D & E items, created by the member.
select set_config('request.jwt.claims', '{"sub":"e3333333-3333-3333-3333-333333333333"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('e0000000-0000-0000-0000-000000000d01', 'e0000000-0000-0000-0000-0000000000dd', 'D priv', 'private', 'e3333333-3333-3333-3333-333333333333'),
  ('e0000000-0000-0000-0000-000000000d02', 'e0000000-0000-0000-0000-0000000000dd', 'D board', 'board', 'e3333333-3333-3333-3333-333333333333'),
  ('e0000000-0000-0000-0000-000000000e01', 'e0000000-0000-0000-0000-0000000000ee', 'E priv', 'private', 'e3333333-3333-3333-3333-333333333333'),
  ('e0000000-0000-0000-0000-000000000e02', 'e0000000-0000-0000-0000-0000000000ee', 'E board', 'board', 'e3333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------------
-- leave_board — owner hands items to a chosen owner
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  $$select public.leave_board('e0000000-0000-0000-0000-0000000000aa',
     (select id from public.memberships where board_id = 'e0000000-0000-0000-0000-0000000000aa'
        and user_id = 'e2222222-2222-2222-2222-222222222222'))$$,
  'an owner can leave, handing items to another owner');
reset role;
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-000000000a02'),
  0, 'the leaving owner''s private item is deleted');
select is((select created_by from public.items where id = 'e0000000-0000-0000-0000-000000000a01'),
  'e2222222-2222-2222-2222-222222222222'::uuid, 'an unassigned board item is re-owned by the receiver');
select is((select created_by from public.items where id = 'e0000000-0000-0000-0000-000000000a03'),
  'e2222222-2222-2222-2222-222222222222'::uuid, 'an assigned item is re-owned by the receiver');
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa' and user_id = 'e1111111-1111-1111-1111-111111111111'),
  0, 'the leaving owner''s membership is gone');

-- ---------------------------------------------------------------------------
-- delete_board — owner, only when alone
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111"}', true);
select lives_ok($$select public.delete_board('e0000000-0000-0000-0000-0000000000bb')$$,
  'an owner can delete a board with no other members');
reset role;
select is((select count(*)::int from public.boards where id = 'e0000000-0000-0000-0000-0000000000bb'),
  0, 'the deleted board is gone');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3333333-3333-3333-3333-333333333333"}', true);
select throws_ok($$select public.delete_board('e0000000-0000-0000-0000-0000000000cc')$$,
  'P0001', null, 'a member cannot delete a board');

select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111"}', true);
select throws_ok($$select public.delete_board('e0000000-0000-0000-0000-0000000000cc')$$,
  'P0001', null, 'an owner cannot delete a board while other members remain');

-- The sole owner of C cannot leave while a member remains.
select throws_ok($$select public.leave_board('e0000000-0000-0000-0000-0000000000cc')$$,
  'P0001', null, 'a sole owner cannot leave until another owner exists');

-- ---------------------------------------------------------------------------
-- leave_board — a member keeps their board items, loses only private
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3333333-3333-3333-3333-333333333333"}', true);
select lives_ok($$select public.leave_board('e0000000-0000-0000-0000-0000000000dd')$$,
  'a member can leave');
reset role;
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-000000000d01'),
  0, 'the leaving member''s private item is deleted');
select is((select created_by from public.items where id = 'e0000000-0000-0000-0000-000000000d02'),
  'e3333333-3333-3333-3333-333333333333'::uuid, 'the leaving member''s board item stays as-is');
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000dd' and user_id = 'e3333333-3333-3333-3333-333333333333'),
  0, 'the leaving member''s membership is gone');

-- ---------------------------------------------------------------------------
-- remove_member — owner removes a member; private items go, the rest stays
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  $$select public.remove_member((select id from public.memberships
     where board_id = 'e0000000-0000-0000-0000-0000000000ee' and user_id = 'e3333333-3333-3333-3333-333333333333'))$$,
  'an owner can remove a member');
reset role;
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-000000000e01'),
  0, 'the removed member''s private item is deleted');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-000000000e02'),
  1, 'the removed member''s board item stays');
select is((select count(*)::int from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000ee' and user_id = 'e3333333-3333-3333-3333-333333333333'),
  0, 'the removed member''s membership is gone');

-- A member cannot remove another member (C still has o1 + the member).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3333333-3333-3333-3333-333333333333"}', true);
select throws_ok(
  $$select public.remove_member((select id from public.memberships
     where board_id = 'e0000000-0000-0000-0000-0000000000cc' and user_id = 'e1111111-1111-1111-1111-111111111111'))$$,
  'P0001', null, 'a member cannot remove another member');

select * from finish();
rollback;
