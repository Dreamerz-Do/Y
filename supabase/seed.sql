-- Development seed data. Never a copy of production (spec 8 / 9.8).
-- Mirrors the sample household from the design so screens have content and the
-- busy block (item 6, a private dated item owned by Laura) is demonstrable.
--
-- Runs after migrations with the local superuser, so it may insert into
-- auth.users directly. The handle_new_user trigger fills public.profiles.

-- Fixed ids keep the seed idempotent across resets.
-- Passwords are all "password123" for local sign-in.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jeffrey@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Jeffrey"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'laura@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Laura"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'oma@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Oma"}')
on conflict (id) do nothing;

-- Board. The creator (Jeffrey) becomes owner via trigger; add the others.
insert into public.boards (id, name, accent_hue, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Huishouden', 215,
        '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.memberships (board_id, user_id, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'guest')
on conflict (board_id, user_id) do nothing;

-- Group "Ouders" = Jeffrey + Laura.
insert into public.groups (id, board_id, name)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ouders')
on conflict (id) do nothing;

insert into public.group_members (group_id, membership_id)
select 'bbbbbbbb-0000-0000-0000-000000000001', m.id
from public.memberships m
where m.board_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and m.user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

-- Items. A mix of to-dos and calendar items, including a private dated item
-- (Tandarts) that appears to Jeffrey and Oma as a busy block only.
insert into public.items (board_id, title, starts_at, ends_at, all_day, visibility, color, created_by)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Kinderen naar opvang brengen', null, null, false, 'board', null, '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Boodschappen doen', null, null, false, 'board', 'amber', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Verjaardag Marja', '2026-04-02 00:00+02', '2026-04-02 23:59+02', true, 'board', 'pink', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Zwemles met Mila', '2026-04-02 17:00+02', '2026-04-02 17:45+02', false, 'board', 'blue', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tandarts', '2026-04-01 10:30+02', '2026-04-01 11:15+02', false, 'private', null, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Verrassingscadeau kopen', null, null, false, 'private', null, '11111111-1111-1111-1111-111111111111');
