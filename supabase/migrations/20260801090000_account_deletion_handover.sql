-- Account deletion when you solely own a board (spec 4.5, open question 1).
--
-- The old delete_current_user() refused outright while the user was the sole
-- owner of any board. That closed the door but never opened another: the only
-- way forward was to leave every such board by hand first. This resolves the
-- question with "prompt to pick a successor":
--
--   * A SOLO board (the user is its only member) is deleted with the account —
--     nobody else's content goes with it.
--   * A board the user SOLELY OWNS while others are still members cannot simply
--     vanish (it would take the household's shared list with it) nor be left
--     ownerless. So the caller nominates a receiving member per board; that
--     member is promoted to owner and the departing owner's items are handed
--     over exactly as `leave_board` does — private items deleted, every other
--     item re-owned by the successor with assignees kept (spec 4.5, resolved 2).
--   * Everywhere else account deletion stays the blunt "erase everything I
--     created" path (spec 4.5): on a board that already has another owner, or
--     where the user is only a member/guest, the items they created are deleted.
--
-- `handovers` is a JSON object mapping {board_id: receiver_membership_id}. The
-- UI collects it up front via boards_awaiting_owner_handover(); the function
-- still validates every entry itself because it runs SECURITY DEFINER and must
-- not trust its input.

begin;

-- The signature changes (gains a jsonb argument with a default), so drop the
-- old zero-argument function first — CREATE OR REPLACE would otherwise leave an
-- ambiguous overload for a no-argument call.
drop function if exists public.delete_current_user();

create or replace function public.delete_current_user(handovers jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  rec record;
  receiver_mid uuid;
  receiver_uid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1. Solo boards (I am the only member) are deleted with me. The cascade
  --    removes their items and my membership; the last-owner guard skips a board
  --    that no longer exists (migration 20260729090000).
  delete from public.boards b
  where exists (select 1 from public.memberships m
                where m.board_id = b.id and m.user_id = uid)
    and not exists (select 1 from public.memberships m
                    where m.board_id = b.id and m.user_id <> uid);

  -- 2. Boards I solely own that still have other members: nominate a successor
  --    from the caller's map and hand over as an owner leaving would.
  for rec in
    select m.board_id
    from public.memberships m
    where m.user_id = uid
      and m.role = 'owner'
      and public.owner_count(m.board_id) = 1
      and exists (select 1 from public.memberships o
                  where o.board_id = m.board_id and o.user_id <> uid)
  loop
    receiver_mid := nullif(handovers ->> rec.board_id::text, '')::uuid;
    if receiver_mid is null then
      raise exception 'choose an owner to receive the boards you solely own';
    end if;

    -- The receiver must be another member of this very board (never me).
    select o.user_id into receiver_uid
    from public.memberships o
    where o.id = receiver_mid and o.board_id = rec.board_id and o.user_id <> uid;
    if receiver_uid is null then
      raise exception 'the chosen receiver is not a member of this board';
    end if;

    -- Promote the successor, then hand over (spec 4.5): private items go, the
    -- rest is re-owned with assignees untouched.
    update public.memberships set role = 'owner' where id = receiver_mid;

    delete from public.items
    where board_id = rec.board_id and created_by = uid and visibility = 'private';

    update public.items set created_by = receiver_uid
    where board_id = rec.board_id and created_by = uid;
  end loop;

  -- 3. The blunt path everywhere else. Handed-over items now belong to the
  --    successor and solo boards are gone, so this clears only my remaining
  --    items (on boards that keep another owner, or where I was a member/guest).
  delete from public.items where created_by = uid;

  -- 4. boards.created_by is provenance with an ON DELETE RESTRICT guard. Hand
  --    any board I created that survives to another owner — every surviving one
  --    has one now (a co-owner, or the successor promoted in step 2).
  update public.boards b
     set created_by = (
       select m.user_id from public.memberships m
       where m.board_id = b.id and m.role = 'owner' and m.user_id <> uid
       limit 1)
   where b.created_by = uid;

  -- 5. Removing the auth user cascades my remaining memberships and profile. No
  --    surviving board is down to me as its last owner, so the guard passes.
  delete from auth.users where id = uid;
end;
$$;

-- Which boards force a successor choice before the account can be deleted: the
-- ones the caller solely owns while other members remain. Returns, per board,
-- its name and the members eligible to receive it (everyone but the caller).
create or replace function public.boards_awaiting_owner_handover()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'board_id', b.id,
    'board_name', b.name,
    'candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'membership_id', c.id,
               'name', p.display_name)
             order by lower(p.display_name)), '[]'::jsonb)
      from public.memberships c
      join public.profiles p on p.id = c.user_id
      where c.board_id = b.id and c.user_id <> auth.uid()
    )
  ) order by lower(b.name)), '[]'::jsonb)
  from public.boards b
  join public.memberships m on m.board_id = b.id
   and m.user_id = auth.uid() and m.role = 'owner'
  where public.owner_count(b.id) = 1
    and exists (select 1 from public.memberships o
                where o.board_id = b.id and o.user_id <> auth.uid());
$$;

revoke all on function public.delete_current_user(jsonb) from anon;
grant execute on function public.delete_current_user(jsonb) to authenticated;
revoke all on function public.boards_awaiting_owner_handover() from anon;
grant execute on function public.boards_awaiting_owner_handover() to authenticated;

commit;
