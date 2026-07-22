-- RLS authorisation tests: the mutation rows of the matrix (spec 4.2), per
-- role. Each check acts as a real `authenticated` role with a real JWT so the
-- policies (and the assignment / last-owner guards) decide the outcome.
--
-- Run locally with:  supabase test db

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures
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
values ('e0000000-0000-0000-0000-0000000000aa', 'Test', 'e1111111-1111-1111-1111-111111111111');

insert into public.memberships (board_id, user_id, role)
values
  ('e0000000-0000-0000-0000-0000000000aa', 'e2222222-2222-2222-2222-222222222222', 'member'),
  ('e0000000-0000-0000-0000-0000000000aa', 'e3333333-3333-3333-3333-333333333333', 'guest');

-- Owner's board item and an item shared with the guest.
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

-- Member's own private item.
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
insert into public.items (id, board_id, title, visibility, created_by)
values ('e0000000-0000-0000-0000-0000000000b2',
        'e0000000-0000-0000-0000-0000000000aa', 'Geheim', 'private',
        'e2222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------------
-- Board settings — owner only
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
update public.boards set name = 'Hacked' where id = 'e0000000-0000-0000-0000-0000000000aa';
reset role;
select is((select name from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa'),
  'Test', 'a member cannot change board settings');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
update public.boards set name = 'Renamed' where id = 'e0000000-0000-0000-0000-0000000000aa';
reset role;
select is((select name from public.boards where id = 'e0000000-0000-0000-0000-0000000000aa'),
  'Renamed', 'an owner can change board settings');

-- ---------------------------------------------------------------------------
-- Invitations — owner only
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
select throws_ok(
  $$insert into public.invitations (board_id, email, invited_by)
    values ('e0000000-0000-0000-0000-0000000000aa', 'x@test',
            'e2222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'a member cannot create an invitation');

select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
select lives_ok(
  $$insert into public.invitations (board_id, email, invited_by)
    values ('e0000000-0000-0000-0000-0000000000aa', 'x@test',
            'e1111111-1111-1111-1111-111111111111')$$,
  'an owner can create an invitation');

-- ---------------------------------------------------------------------------
-- Groups — owner only
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
select throws_ok(
  $$insert into public.groups (board_id, name)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Poging')$$,
  '42501', null, 'a member cannot create a group');

select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
select lives_ok(
  $$insert into public.groups (board_id, name)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Ouders')$$,
  'an owner can create a group');

-- ---------------------------------------------------------------------------
-- Creating items / assigning to others
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
-- A guest may not assign an item to another member (assignment guard).
select throws_ok(
  $$insert into public.items (board_id, title, visibility, created_by, assignee_id)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Voor Mees', 'board',
            'e3333333-3333-3333-3333-333333333333',
            (select id from public.memberships
             where board_id = 'e0000000-0000-0000-0000-0000000000aa'
               and user_id = 'e2222222-2222-2222-2222-222222222222'))$$,
  'P0001', null, 'a guest cannot assign an item to another member');
-- But a guest may create an item for themselves.
select lives_ok(
  $$insert into public.items (board_id, title, visibility, created_by)
    values ('e0000000-0000-0000-0000-0000000000aa', 'Eigen taak', 'board',
            'e3333333-3333-3333-3333-333333333333')$$,
  'a guest can create an item for themselves');

-- ---------------------------------------------------------------------------
-- Editing others' items
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
update public.items set title = 'Edited' where id = 'e0000000-0000-0000-0000-0000000000b1';
reset role;
select is((select title from public.items where id = 'e0000000-0000-0000-0000-0000000000b1'),
  'Edited', 'a member can edit another member''s item');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
update public.items set title = 'Nope' where id = 'e0000000-0000-0000-0000-0000000000b3';
reset role;
select is((select title from public.items where id = 'e0000000-0000-0000-0000-0000000000b3'),
  'Cadeau', 'a guest cannot edit an item merely shared with them');

-- ---------------------------------------------------------------------------
-- Deleting items
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-3333-3333-333333333333","email":"guest@test"}', true);
delete from public.items where id = 'e0000000-0000-0000-0000-0000000000b1';
reset role;
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b1'),
  1, 'a guest cannot delete another member''s item');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
delete from public.items where id = 'e0000000-0000-0000-0000-0000000000b2';
reset role;
select is((select count(*)::int from public.items where id = 'e0000000-0000-0000-0000-0000000000b2'),
  0, 'a member can delete their own item');

-- ---------------------------------------------------------------------------
-- Changing roles — owner only, and the member cannot touch the owner
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-2222-2222-222222222222","email":"member@test"}', true);
update public.memberships set role = 'member'
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e1111111-1111-1111-1111-111111111111';
reset role;
select is((select role::text from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e1111111-1111-1111-1111-111111111111'),
  'owner', 'a member cannot change roles');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-1111-1111-111111111111","email":"owner@test"}', true);
update public.memberships set role = 'guest'
  where board_id = 'e0000000-0000-0000-0000-0000000000aa'
    and user_id = 'e2222222-2222-2222-2222-222222222222';
reset role;
select is((select role::text from public.memberships
           where board_id = 'e0000000-0000-0000-0000-0000000000aa'
             and user_id = 'e2222222-2222-2222-2222-222222222222'),
  'guest', 'an owner can change a member''s role');

select * from finish();
rollback;
