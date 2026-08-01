-- Account deletion tests (spec 4.5, resolved question 1): delete_current_user
-- with successor handover, and boards_awaiting_owner_handover.
--
-- Scenarios exercised for the deleting user a1:
--   S — a SOLO board (only a1): deleted with the account.
--   T — a SHARED board a1 solely owns (a2 member, a3 guest): a1 nominates a2,
--       who is promoted to owner; a1's private item is deleted, the rest is
--       re-owned by a2 with assignees kept; a2's own item is untouched.
--   X — a CO-OWNED board (a1 + a4 owners): stays; a1's items there are erased
--       (the blunt path) and provenance moves to a4.
-- Separately, a5 solely owns R (a6 member) and deletes WITHOUT a map — refused.
--
-- Run locally with:  supabase test db

begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a1@test', now(), now(), '{"provider":"email"}', '{"display_name":"Ann"}'),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a2@test', now(), now(), '{"provider":"email"}', '{"display_name":"Bo"}'),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a3@test', now(), now(), '{"provider":"email"}', '{"display_name":"Cas"}'),
  ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a4@test', now(), now(), '{"provider":"email"}', '{"display_name":"Dex"}'),
  ('a5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a5@test', now(), now(), '{"provider":"email"}', '{"display_name":"Eef"}'),
  ('a6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a6@test', now(), now(), '{"provider":"email"}', '{"display_name":"Fay"}');

-- Boards (creator becomes owner via the on_board_created trigger).
insert into public.boards (id, name, created_by) values
  ('b0000000-0000-0000-0000-0000000000aa', 'S solo',   'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000bb', 'T shared', 'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000cc', 'X co',     'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000dd', 'R shared', 'a5555555-5555-5555-5555-555555555555');

insert into public.memberships (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000bb', 'a2222222-2222-2222-2222-222222222222', 'member'),
  ('b0000000-0000-0000-0000-0000000000bb', 'a3333333-3333-3333-3333-333333333333', 'guest'),
  ('b0000000-0000-0000-0000-0000000000cc', 'a4444444-4444-4444-4444-444444444444', 'owner'),
  ('b0000000-0000-0000-0000-0000000000dd', 'a6666666-6666-6666-6666-666666666666', 'member');

-- a1's items: on T a board item, a private item, one assigned to a2; on X a
-- board item. (Impersonate a1 so insert policies and the assignment guard run.)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000bb', 'T board', 'board', 'a1111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-0000000000bb', 'T priv', 'private', 'a1111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-0000000000cc', 'X board', 'board', 'a1111111-1111-1111-1111-111111111111');
insert into public.items (id, board_id, title, visibility, created_by, assignee_id) values
  ('c0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-0000000000bb', 'T assigned', 'board',
   'a1111111-1111-1111-1111-111111111111',
   (select id from public.memberships where board_id = 'b0000000-0000-0000-0000-0000000000bb' and user_id = 'a2222222-2222-2222-2222-222222222222'));

-- a2's own item on T.
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('c0000000-0000-0000-0000-0000000000b4', 'b0000000-0000-0000-0000-0000000000bb', 'T bo-own', 'board', 'a2222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------------
-- boards_awaiting_owner_handover — only the solely-owned shared board (T)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111"}', true);
select is(
  jsonb_array_length(public.boards_awaiting_owner_handover()),
  1, 'only the solely-owned shared board needs a successor');
select is(
  (public.boards_awaiting_owner_handover() -> 0 ->> 'board_id')::uuid,
  'b0000000-0000-0000-0000-0000000000bb'::uuid, 'that board is T');

-- ---------------------------------------------------------------------------
-- Refused when a sole owner supplies no successor (a5 on R)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5555555-5555-5555-5555-555555555555"}', true);
select throws_ok($$select public.delete_current_user('{}'::jsonb)$$,
  'P0001', null, 'deletion is refused without a successor for a solely-owned board');
reset role;
select is(
  (select role::text from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000dd' and user_id = 'a5555555-5555-5555-5555-555555555555'),
  'owner', 'the refused deletion left the board untouched');

-- ---------------------------------------------------------------------------
-- Successful deletion with a successor map (a1 hands T to a2)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  $$select public.delete_current_user(jsonb_build_object(
      'b0000000-0000-0000-0000-0000000000bb',
      (select id::text from public.memberships
         where board_id = 'b0000000-0000-0000-0000-0000000000bb'
           and user_id = 'a2222222-2222-2222-2222-222222222222')))$$,
  'the account is deleted once a successor is nominated');
reset role;

-- Solo board S is gone.
select is((select count(*)::int from public.boards where id = 'b0000000-0000-0000-0000-0000000000aa'),
  0, 'the solo board is deleted with the account');

-- Shared board T survives, now owned by a2.
select is((select count(*)::int from public.boards where id = 'b0000000-0000-0000-0000-0000000000bb'),
  1, 'the solely-owned shared board survives');
select is(
  (select role::text from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000bb' and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'owner', 'the nominated successor is promoted to owner');

-- a1's items on T: private gone, the rest re-owned by a2, assignee kept.
select is((select count(*)::int from public.items where id = 'c0000000-0000-0000-0000-0000000000b2'),
  0, 'the departing owner''s private item is deleted');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b1'),
  'a2222222-2222-2222-2222-222222222222'::uuid, 'a board item is re-owned by the successor');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b3'),
  'a2222222-2222-2222-2222-222222222222'::uuid, 'an assigned item is re-owned by the successor');
select is(
  (select assignee_id from public.items where id = 'c0000000-0000-0000-0000-0000000000b3'),
  (select id from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000bb' and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'the assignee is unchanged by the handover');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b4'),
  'a2222222-2222-2222-2222-222222222222'::uuid, 'the successor''s own item is untouched');

-- Co-owned board X: stays, provenance to a4, a1's item there erased.
select is((select count(*)::int from public.boards where id = 'b0000000-0000-0000-0000-0000000000cc'),
  1, 'a co-owned board survives');
select is((select created_by from public.boards where id = 'b0000000-0000-0000-0000-0000000000cc'),
  'a4444444-4444-4444-4444-444444444444'::uuid, 'its provenance moves to a remaining owner');
select is((select count(*)::int from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  0, 'the account''s items on a co-owned board are erased (blunt path)');

-- The user and their memberships are gone.
select is((select count(*)::int from auth.users where id = 'a1111111-1111-1111-1111-111111111111'),
  0, 'the auth user is deleted');
select is((select count(*)::int from public.memberships where user_id = 'a1111111-1111-1111-1111-111111111111'),
  0, 'all of the account''s memberships are gone');

select * from finish();
rollback;
