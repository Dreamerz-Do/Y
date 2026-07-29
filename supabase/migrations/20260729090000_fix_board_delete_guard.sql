-- Let an owner delete a board (spec 4.2).
--
-- Deleting a board cascade-deletes its memberships (memberships.board_id ON
-- DELETE CASCADE). That cascade fires guard_last_owner on the owner's own row,
-- which sees owner_count() = 1 and raises "a board must keep at least one owner"
-- — so the board delete always failed and an owner could never remove a board.
--
-- When the board itself is gone the guard is moot: there is no board left to
-- keep an owner for. The cascade runs as an AFTER-DELETE action on boards, so by
-- the time the membership trigger fires the parent row is already deleted; a
-- simple existence check short-circuits the guard in exactly that case and
-- nowhere else (normal member management still sees the board and is unaffected).

begin;

create or replace function public.guard_last_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_board uuid;
begin
  target_board := coalesce(old.board_id, new.board_id);

  -- The board is being deleted (this membership is a cascade victim): nothing
  -- to guard, the whole board is going away.
  if tg_op = 'DELETE' and not exists (select 1 from public.boards where id = target_board) then
    return old;
  end if;

  if tg_op = 'DELETE' and old.role <> 'owner' then
    return old;
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role = 'owner' then
    return new;
  end if;
  -- We are removing or demoting an owner; make sure another remains.
  if old.role = 'owner' and public.owner_count(target_board) <= 1 then
    raise exception 'a board must keep at least one owner';
  end if;
  return coalesce(new, old);
end;
$$;

commit;
