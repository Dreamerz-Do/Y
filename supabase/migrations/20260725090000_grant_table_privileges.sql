-- Base table privileges for the PostgREST roles.
--
-- RLS is two separate checks: whether the role has table-level privilege at
-- all, and whether the row policies allow a given row. The initial migration
-- set up every policy but left the first check to Supabase's implicit default
-- privileges — which the local test stack does not apply to our tables, so
-- `authenticated` was denied outright (permission denied for table ...) before
-- any policy ran. The same wall would hit the real app, since PostgREST
-- connects as `authenticated`.
--
-- Grant the privileges explicitly here. RLS remains the real guard: every row a
-- role can reach is still filtered by the policies in the initial migration.
-- `anon` gets nothing — the app requires authentication and no policy grants
-- anonymous access.

begin;

grant usage on schema public to anon, authenticated;

-- Table-level DML for authenticated; the policies decide which rows.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- The busy-block projection stays readable and content-free (spec 3.2); it is
-- not insertable/updatable, so only SELECT is meaningful.
revoke insert, update, delete on public.calendar_busy_blocks from authenticated;

commit;
