-- create_board RPC (fixes the board-creation RLS round-trip).
--
-- Creating a board from the client with `.insert().select()` fails: the
-- RETURNING is re-checked against the boards SELECT policy (is_board_member),
-- but the creator's owner membership is added by the on_board_created
-- AFTER-INSERT trigger, which has not fired yet — so the just-inserted row is
-- momentarily invisible and Postgres raises a row-level security error.
--
-- Doing the insert inside a SECURITY DEFINER function avoids this: the function
-- runs with the definer's rights, so RETURNING is not gated by the caller's
-- RLS, and the database still generates the id (gen_random_uuid()). The
-- on_board_created trigger creates the owner membership as usual.

begin;

create or replace function public.create_board(board_name text, accent smallint default 215)
returns public.boards
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b public.boards;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.boards (name, accent_hue, created_by)
  values (board_name, accent, uid)
  returning * into b;
  -- The owner membership is created by the on_board_created trigger.

  return b;
end;
$$;

revoke all on function public.create_board(text, smallint) from anon;
grant execute on function public.create_board(text, smallint) to authenticated;

commit;
