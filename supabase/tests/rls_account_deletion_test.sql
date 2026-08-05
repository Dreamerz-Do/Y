-- Account deletion tests (spec 4.5, resolved question 1): delete_current_user
-- keeps non-private items by re-owning them to the "deleted user" sentinel, and
-- boards_awaiting_owner_handover lists boards needing a successor.
--
-- Scenarios for the deleting user a1:
--   S — a SOLO board (only a1): deleted with the account.
--   T — a board a1 SOLELY OWNS (a2 member, a3 guest): a2 is nominated and
--       promoted to owner; a1's private item is deleted, the rest re-owned by
--       the sentinel (assignees kept); a2's own item is untouched.
--   X — a CO-OWNED board (a1 + a4): survives; a1's private item goes, the board
--       item is KEPT (sentinel-owned); provenance moves to a4.
--   G — a board where a1 is a GUEST (a5 owner, a6 member) holding an item a1
--       created while still a member, assigned to a6: kept (sentinel-owned),
--       assignee untouched — this exercises the assignment-guard skip.
-- Separately, a7 solely owns R (a8 member) and deletes WITHOUT a map — refused.
--
-- Run locally with:  supabase test db

begin;
select plan(21);

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
   'authenticated', 'authenticated', 'a6@test', now(), now(), '{"provider":"email"}', '{"display_name":"Fay"}'),
  ('a7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a7@test', now(), now(), '{"provider":"email"}', '{"display_name":"Gid"}'),
  ('a8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a8@test', now(), now(), '{"provider":"email"}', '{"display_name":"Hix"}');

-- Boards (creator becomes owner via the on_board_created trigger).
insert into public.boards (id, name, created_by) values
  ('b0000000-0000-0000-0000-0000000000aa', 'S solo',   'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000bb', 'T shared', 'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000cc', 'X co',     'a1111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-0000000000ee', 'G guest',  'a5555555-5555-5555-5555-555555555555'),
  ('b0000000-0000-0000-0000-0000000000dd', 'R shared', 'a7777777-7777-7777-7777-777777777777');

-- Extra memberships. a1 joins G as a member first (so it can create an assigned
-- item), then is demoted to guest below.
insert into public.memberships (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000bb', 'a2222222-2222-2222-2222-222222222222', 'member'),
  ('b0000000-0000-0000-0000-0000000000bb', 'a3333333-3333-3333-3333-333333333333', 'guest'),
  ('b0000000-0000-0000-0000-0000000000cc', 'a4444444-4444-4444-4444-444444444444', 'owner'),
  ('b0000000-0000-0000-0000-0000000000ee', 'a1111111-1111-1111-1111-111111111111', 'member'),
  ('b0000000-0000-0000-0000-0000000000ee', 'a6666666-6666-6666-6666-666666666666', 'member'),
  ('b0000000-0000-0000-0000-0000000000dd', 'a8888888-8888-8888-8888-888888888888', 'member');

-- a1's items: on T a board item, a private item, one assigned to a2; on X a
-- board item and a private item; on G an item assigned to a6 (a1 is a member).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000bb', 'T board', 'board', 'a1111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-0000000000bb', 'T priv', 'private', 'a1111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-0000000000cc', 'X board', 'board', 'a1111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-0000000000c2', 'b0000000-0000-0000-0000-0000000000cc', 'X priv', 'private', 'a1111111-1111-1111-1111-111111111111');
insert into public.items (id, board_id, title, visibility, created_by, assignee_id) values
  ('c0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-0000000000bb', 'T assigned', 'board',
   'a1111111-1111-1111-1111-111111111111',
   (select id from public.memberships where board_id = 'b0000000-0000-0000-0000-0000000000bb' and user_id = 'a2222222-2222-2222-2222-222222222222')),
  ('c0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000ee', 'G assigned', 'board',
   'a1111111-1111-1111-1111-111111111111',
   (select id from public.memberships where board_id = 'b0000000-0000-0000-0000-0000000000ee' and user_id = 'a6666666-6666-6666-6666-666666666666'));

-- a2's own item on T.
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222"}', true);
insert into public.items (id, board_id, title, visibility, created_by) values
  ('c0000000-0000-0000-0000-0000000000b4', 'b0000000-0000-0000-0000-0000000000bb', 'T bo-own', 'board', 'a2222222-2222-2222-2222-222222222222');

-- Demote a1 to guest on G now that the assigned item exists.
reset role;
update public.memberships set role = 'guest'
where board_id = 'b0000000-0000-0000-0000-0000000000ee' and user_id = 'a1111111-1111-1111-1111-111111111111';

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
-- Successful deletion with a successor map (a1 nominates a2 for T)
-- ---------------------------------------------------------------------------
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

-- a1's items on T: private gone, the rest kept by the sentinel, assignee kept.
select is((select count(*)::int from public.items where id = 'c0000000-0000-0000-0000-0000000000b2'),
  0, 'the departing owner''s private item is deleted');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b1'),
  '00000000-0000-0000-0000-0000000000de'::uuid, 'a board item is kept, owned by the sentinel');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b3'),
  '00000000-0000-0000-0000-0000000000de'::uuid, 'an assigned item is kept, owned by the sentinel');
select is(
  (select assignee_id from public.items where id = 'c0000000-0000-0000-0000-0000000000b3'),
  (select id from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000bb' and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'the assignee is unchanged');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000b4'),
  'a2222222-2222-2222-2222-222222222222'::uuid, 'another member''s own item is untouched');

-- Co-owned board X: survives, provenance to a4, private gone, board item kept.
select is((select count(*)::int from public.boards where id = 'b0000000-0000-0000-0000-0000000000cc'),
  1, 'a co-owned board survives');
select is((select created_by from public.boards where id = 'b0000000-0000-0000-0000-0000000000cc'),
  'a4444444-4444-4444-4444-444444444444'::uuid, 'its provenance moves to a remaining owner');
select is((select count(*)::int from public.items where id = 'c0000000-0000-0000-0000-0000000000c2'),
  0, 'the private item on a co-owned board is deleted');
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  '00000000-0000-0000-0000-0000000000de'::uuid, 'the board item on a co-owned board is kept by the sentinel');

-- Guest board G: the assigned item is kept (guard skip), assignee untouched.
select is((select created_by from public.items where id = 'c0000000-0000-0000-0000-0000000000e1'),
  '00000000-0000-0000-0000-0000000000de'::uuid, 'a guest''s assigned item is kept by the sentinel');
select is(
  (select assignee_id from public.items where id = 'c0000000-0000-0000-0000-0000000000e1'),
  (select id from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000ee' and user_id = 'a6666666-6666-6666-6666-666666666666'),
  'the assignee on the kept guest-board item is unchanged');

-- The user and their memberships are gone.
select is((select count(*)::int from public.memberships where user_id = 'a1111111-1111-1111-1111-111111111111'),
  0, 'all of the account''s memberships are gone');
select is((select count(*)::int from auth.users where id = 'a1111111-1111-1111-1111-111111111111'),
  0, 'the auth user is deleted');

-- ---------------------------------------------------------------------------
-- Refused when a sole owner supplies no successor (a7 on R)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7777777-7777-7777-7777-777777777777"}', true);
select throws_ok($$select public.delete_current_user('{}'::jsonb)$$,
  'P0001', null, 'deletion is refused without a successor for a solely-owned board');
reset role;
select is(
  (select role::text from public.memberships
     where board_id = 'b0000000-0000-0000-0000-0000000000dd' and user_id = 'a7777777-7777-7777-7777-777777777777'),
  'owner', 'the refused deletion left the board untouched');

select * from finish();
rollback;
