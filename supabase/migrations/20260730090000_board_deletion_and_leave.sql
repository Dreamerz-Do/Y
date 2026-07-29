-- Board deletion, leaving and member removal (spec 4.5).
--
-- These run as SECURITY DEFINER so they can move item ownership and delete a
-- board across RLS. Because RLS is bypassed, every function re-checks the
-- caller's authorisation itself (auth.uid() + role), and each keeps to a single
-- board.
--
-- Rules:
--   delete_board  — an owner may delete a board ONLY when no other members
--                   remain (nobody's shared content is taken with it).
--   leave_board   — I remove myself. My PRIVATE items are always deleted. If I
--                   am an owner, another owner must remain and I hand my other
--                   items (board + shared_with, assigned or not) to a chosen
--                   receiving owner; assignees are kept. A plain member's other
--                   items simply stay on the board.
--   remove_member — an owner removes someone else; that person's private items
--                   are deleted, the rest stays. The last-owner trigger still
--                   guards against removing the final owner.

begin;

-- Delete a board — owner-only, and only when alone.
create or replace function public.delete_board(b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_board_owner(b) then
    raise exception 'only an owner can delete a board';
  end if;
  if exists (select 1 from public.memberships where board_id = b and user_id <> uid) then
    raise exception 'a board can only be deleted when no other members remain';
  end if;
  delete from public.boards where id = b;
end;
$$;

-- Leave a board. `receiver` is a membership id of another owner and is required
-- only when the caller is an owner.
create or replace function public.leave_board(b uuid, receiver uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_mid uuid;
  my_role public.board_role;
  other_owners int;
  receiver_uid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id, role into my_mid, my_role
  from public.memberships where board_id = b and user_id = uid;
  if my_mid is null then
    raise exception 'not a member of this board';
  end if;

  if not exists (select 1 from public.memberships where board_id = b and user_id <> uid) then
    raise exception 'you are the only member; delete the board instead';
  end if;

  -- Private items are personal and always go.
  delete from public.items
  where board_id = b and created_by = uid and visibility = 'private';

  if my_role = 'owner' then
    select count(*) into other_owners
    from public.memberships where board_id = b and role = 'owner' and user_id <> uid;
    if other_owners = 0 then
      raise exception 'appoint another owner before leaving';
    end if;

    if receiver is null then
      raise exception 'choose an owner to receive your items';
    end if;
    select user_id into receiver_uid
    from public.memberships
    where id = receiver and board_id = b and role = 'owner' and user_id <> uid;
    if receiver_uid is null then
      raise exception 'the chosen receiver is not another owner of this board';
    end if;

    -- Hand the rest of my items to the receiving owner; assignees stay put.
    update public.items set created_by = receiver_uid
    where board_id = b and created_by = uid;
  end if;

  -- Removing my membership clears assignments to me (assignee_id FK → null).
  delete from public.memberships where id = my_mid;
end;
$$;

-- An owner removes another member. Their private items go; the rest stays.
create or replace function public.remove_member(m uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_board uuid;
  target_uid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select board_id, user_id into target_board, target_uid
  from public.memberships where id = m;
  if target_board is null then
    raise exception 'membership not found';
  end if;
  if target_uid = uid then
    raise exception 'use leave_board to remove yourself';
  end if;
  if not public.is_board_owner(target_board) then
    raise exception 'only an owner can remove members';
  end if;

  delete from public.items
  where board_id = target_board and created_by = target_uid and visibility = 'private';

  -- The last-owner trigger guards against removing the final owner.
  delete from public.memberships where id = m;
end;
$$;

revoke all on function public.delete_board(uuid) from anon;
revoke all on function public.leave_board(uuid, uuid) from anon;
revoke all on function public.remove_member(uuid) from anon;
grant execute on function public.delete_board(uuid) to authenticated;
grant execute on function public.leave_board(uuid, uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;

commit;
