-- RLS visibility tests (spec 3.2 and the "See ..." rows of the matrix 4.2).
--
-- The database itself is under test here, not the client: each check runs as a
-- real `authenticated` role with a real JWT, so the policies decide what comes
-- back. "A policy without a test counts as absent" (spec 9.5).
--
-- Run locally with:  supabase test db
-- In CI: against a throwaway instance, never against development (spec 9.8).

begin;
select plan(17);

-- ---------------------------------------------------------------------------
-- Fixtures. Users and board/memberships are created as the superuser (bypasses
-- RLS); items are inserted while impersonating their creator, so the INSERT
-- policies and assignment guard are exercised as a side effect.
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
   '{"provider":"email"}', '{"display_name":"Gijs"}'),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@test', now(), now(),
   '{"provider":"email"}', '{"display_name":"Nel"}');

-- Board; the creator becomes owner through the on_board_created trigger.
insert into public.boards (id, name, created_by)
values ('e0000000-0000-0000-0000-0000000000aa', 'Test', 'e1111111-1111-1111-1111-111111111111');

insert into public.memberships (board_id, user_id, role)
values
  ('e0000000-0000-0000-0000-0000000000aa', 'e2222222-2222-2222-2222-222222222222', 'member'),
  ('e0000000-0000-0000-0000-0000000000aa', 'e3333333-3333-3333-3333-333333333333', 'guest');

-- Helper to read a membership id.
-- (Inlined below as subqueries to avoid creating objects in the test tx.)

-- Items created by the owner.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);

insert into public.items (id, board_id, title, visibility, created_by)
values ('e0000000-0000-0000-0000-0000000000b1',
        'e0000000-0000-0000-0000-0000000000aa', 'Board item', 'board',
        'e1111111-1111-1111-1111-111111111111');

insert into public.items (id, board_id, title, visibility, created_by)
values ('e0000000-0000-0000-0000-0000000000b3',
        'e0000000-0000-0000-0000-0000000000aa', 'Cadeau', 'shared_with',
        'e1111111-1111-1111-1111-111111111111');

insert into public.item_shares (item_id, membership_id)
values ('e0000000-0000-0000-0000-0000000000b3',
        (select id from public.memberships
         where board_id = 'e0000000-0000-0000-0000-0000000000aa'
           and user_id = 'e3333333-3333-3333-3333-333333333333'));

-- Board-wide item assigned to the guest (guest sees it via the assignee branch).
insert into public.items (id, board_id, title, visibility, created_by, assignee_id)
values ('e0000000-0000-0000-0000-0000000000b4',
        'e0000000-0000-0000-0000-0000000000aa', 'Klus voor gast', 'board',
        'e1111111-1111-1111-1111-111111111111',
        (select id from public.memberships
         where board_id = 'e0000000-0000-0000-0000-0000000000aa'
           and user_id = 'e3333333-3333-3333-3333-333333333333'));

-- Private, dated item created by the member (the busy-block source).
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
insert into public.items (id, board_id, title, visibility, created_by, starts_at, ends_at)
values ('e0000000-0000-0000-0000-0000000000b2',
        'e0000000-0000-0000-0000-0000000000aa', 'Geheim', 'private',
        'e2222222-2222-2222-2222-222222222222',
        '2026-05-01 10:00+02', '2026-05-01 11:00+02');

-- ---------------------------------------------------------------------------
-- Owner's view
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);

select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b1'),
  1, 'owner sees a board-wide item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b3'),
  1, 'owner sees their own shared_with item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b4'),
  1, 'owner sees a board-wide assigned item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b2'),
  0, 'owner does NOT see another member''s private item');

-- ---------------------------------------------------------------------------
-- Member's view
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);

select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b1'),
  1, 'member sees a board-wide item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b2'),
  1, 'member sees their own private item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b3'),
  0, 'member does NOT see an item shared only with the guest');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b4'),
  1, 'member sees a board-wide item assigned to someone else');

-- ---------------------------------------------------------------------------
-- Guest's view — only what is shared with or assigned to them
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);

select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b1'),
  0, 'guest does NOT see a plain board-wide item');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b3'),
  1, 'guest sees an item shared with them');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b4'),
  1, 'guest sees an item assigned to them');
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b2'),
  0, 'guest does NOT see a private item');

-- ---------------------------------------------------------------------------
-- Outsider — not a member, sees nothing on the board
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e4444444-4444-4444-4444-444444444444","email":"outsider@test"}', true);

select is((select count(*)::int from public.items
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'),
  0, 'a non-member sees no items on the board');

-- ---------------------------------------------------------------------------
-- Busy block (spec 3.2): the private dated item shows to others as a
-- content-free block; not to its own creator.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
select is((select count(*)::int from public.calendar_busy_blocks
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'),
  1, 'owner sees one busy block for the member''s private dated item');
select isnt((select owner_name from public.calendar_busy_blocks
             where board_id = 'e0000000-0000-0000-0000-0000000000aa' limit 1),
  null, 'the busy block reveals the owner name when reveal_owner is true');

select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
select is((select count(*)::int from public.calendar_busy_blocks
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'),
  0, 'the private item''s own creator sees no busy block for it');

-- The projection carries no content columns, by construction.
reset role;
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'calendar_busy_blocks'
             and column_name in ('title', 'notes', 'assignee_id')),
  0, 'the busy-block view exposes no title, notes or participants');

select * from finish();
rollback;
