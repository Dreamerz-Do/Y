-- Schema relationship tests.
--
-- PostgREST resolves embedded resources through foreign keys. The members query
-- (boardRepository.members) embeds `profiles(...)` off `memberships`; without a
-- FK between them the embed errors and the members list silently comes back
-- empty, which hides the invite / group / leave controls. This asserts the
-- relationship exists so that regression cannot return unnoticed — the mocked
-- Vitest/e2e suites never touch real PostgREST and cannot catch it.
--
-- memberships.user_id keeps its original FK to auth.users, so it has two foreign
-- keys. pgTAP's fk_ok inspects only one FK per column, so we assert against the
-- catalog: there must be *a* FK from memberships to public.profiles.
--
-- Run locally with:  supabase test db

begin;
select plan(1);

select ok(
  exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.memberships'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'public.memberships has a foreign key to public.profiles (so PostgREST can embed member display data)'
);

select * from finish();
rollback;
