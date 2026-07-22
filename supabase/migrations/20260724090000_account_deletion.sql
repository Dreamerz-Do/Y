-- Account deletion as a real feature (spec 8 — a Play-Store requirement — and
-- spec 4.5). A user must be able to delete their own account, including the
-- data they own. This runs through a SECURITY DEFINER function, never a manual
-- database action and never the service key in client code (hard rule 7).
--
-- Semantics (spec 4.5):
--   * everything the user owns (items they created) is permanently deleted
--   * assignments to them are cleared (assignee_id ... on delete set null)
--   * memberships and profile disappear with the auth user
--
-- Open question 1 in spec 4.5 — what happens when the departing user is the
-- SOLE owner of a board — is deliberately NOT resolved here. Rather than
-- silently delete a shared board (and everyone else's data in it) or leave it
-- ownerless, deletion is refused with a clear message until ownership is
-- transferred or the board is deleted. That keeps the settled rule "a board
-- always keeps at least one owner" intact.

begin;

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  blocking_board uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Refuse while the user is the only owner of any board (open question 1).
  select m.board_id into blocking_board
  from public.memberships m
  where m.user_id = uid
    and m.role = 'owner'
    and public.owner_count(m.board_id) = 1
  limit 1;
  if blocking_board is not null then
    raise exception
      'transfer ownership or delete the boards you solely own before deleting your account';
  end if;

  -- Items the user created are permanently deleted. Assignments to the user on
  -- items owned by others clear automatically through the assignee_id FK.
  delete from public.items where created_by = uid;

  -- boards.created_by is provenance with an ON DELETE RESTRICT guard, so hand
  -- any board the user created to a remaining owner before removing the user.
  -- Every such board still has another owner (the sole-owner case was refused
  -- above), so the subquery always finds one.
  update public.boards b
     set created_by = (
       select m.user_id
       from public.memberships m
       where m.board_id = b.id and m.role = 'owner' and m.user_id <> uid
       limit 1
     )
   where b.created_by = uid;

  -- Removing the auth user cascades memberships, group memberships and profile.
  -- The last-owner trigger passes because no owned board is down to one owner.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from anon;
grant execute on function public.delete_current_user() to authenticated;

commit;
