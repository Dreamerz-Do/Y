-- Let PostgREST embed member display data (fixes an empty members list).
--
-- boardRepository.members() selects `profiles(display_name,color_hue)` off
-- `memberships`. PostgREST resolves such embeds through a foreign key, but
-- `memberships.user_id` only referenced `auth.users` — there was no
-- relationship to `public.profiles`. So the embed failed with "could not find a
-- relationship", the repository threw, and the members list came back empty.
-- That in turn hid the invite, group and leave controls, because the members
-- screen derives ownership from that list (isOwner = my row's role == 'owner').
--
-- Every user has a profile row (the handle_new_user trigger on auth.users), and
-- a membership's user_id is always such a user, so the constraint holds for all
-- existing rows. This adds a second FK on user_id (alongside the auth.users one)
-- purely so the profiles relationship is discoverable.

begin;

alter table public.memberships
  add constraint memberships_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

commit;
