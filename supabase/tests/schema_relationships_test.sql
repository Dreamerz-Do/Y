-- Schema relationship tests.
--
-- PostgREST resolves embedded resources through foreign keys. The members query
-- (boardRepository.members) embeds `profiles(...)` off `memberships`; without a
-- FK between them the embed errors and the members list silently comes back
-- empty, which hides the invite / group / leave controls. This asserts the
-- relationship exists so that regression cannot return unnoticed — the mocked
-- Vitest/e2e suites never touch real PostgREST and cannot catch it.
--
-- Run locally with:  supabase test db

begin;
select plan(1);

select fk_ok('public', 'memberships', 'user_id', 'public', 'profiles', 'id');

select * from finish();
rollback;
