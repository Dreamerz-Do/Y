-- Account deletion (spec 4.5, resolved question 1).
--
-- Account deletion is now consistent with leaving a board rather than a blunt
-- "erase everything I created": on every board that survives, the user's
-- private items are deleted and their other items are KEPT, re-owned to a
-- fictive "deleted user" sentinel so no real person is falsely credited and the
-- board's owners keep full control (they may edit any item on the board, RLS
-- can_edit_others). Concretely:
--
--   * A SOLO board (the user is its only member) is deleted with the account.
--   * A board the user SOLELY OWNS while others remain must keep an owner, so
--     the caller nominates a successor per board (via boards_awaiting_owner_
--     handover()); that member is promoted to owner. The board-level ownership
--     transfers; the items themselves go to the sentinel like everywhere else.
--   * On every other board (another owner already present, or the user is only
--     a member/guest) nothing needs nominating — private items go, the rest is
--     reattributed to the sentinel in place.
--
-- `handovers` is a JSON object mapping {board_id: successor_membership_id},
-- required only for the solely-owned-with-members boards. The function runs
-- SECURITY DEFINER and validates every entry itself.

begin;

-- ---------------------------------------------------------------------------
-- The "deleted user" sentinel. A single, well-known auth user that owns items
-- left behind by deleted accounts. It is a member of no board, so it never
-- appears in member lists nor counts toward owners; it exists only to satisfy
-- items.created_by (NOT NULL, ON DELETE CASCADE) without deleting kept items.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'deleted-user@system.invalid', now(), now(),
   '{"provider":"system"}', '{"display_name":"Verwijderde gebruiker"}')
on conflict (id) do nothing;

-- handle_new_user seeds the profile from the metadata above; make it explicit
-- and idempotent in case the trigger is ever absent.
insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-0000000000de', 'Verwijderde gebruiker')
on conflict (id) do update set display_name = excluded.display_name;

-- ---------------------------------------------------------------------------
-- The assignment guard should police assignment *changes*, not every update.
-- Reattributing created_by (below, and when an owner leaves) leaves assignee_id
-- untouched, so skip the check when it has not changed. Insertions and genuine
-- assignee changes are still fully guarded — this narrows nothing security-wise.
-- ---------------------------------------------------------------------------
create or replace function public.guard_item_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  if new.assignee_id is not null
     and new.assignee_id <> public.my_membership_id(new.board_id)
     and not public.can_edit_others(new.board_id) then
    raise exception 'only owners and members may assign items to others';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion.
-- ---------------------------------------------------------------------------
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
  sentinel constant uuid := '00000000-0000-0000-0000-0000000000de';
  rec record;
  receiver_mid uuid;
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

  -- 2. Boards I solely own that still have other members must keep an owner:
  --    promote the nominated successor. Only the board-level ownership moves;
  --    the items themselves go to the sentinel in step 4 like everywhere else.
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
    -- The successor must be another member of this very board (never me).
    if not exists (
      select 1 from public.memberships o
      where o.id = receiver_mid and o.board_id = rec.board_id and o.user_id <> uid
    ) then
      raise exception 'the chosen successor is not a member of this board';
    end if;
    update public.memberships set role = 'owner' where id = receiver_mid;
  end loop;

  -- 3. Private items are personal and always deleted.
  delete from public.items where created_by = uid and visibility = 'private';

  -- 4. Everything else I created is KEPT but re-owned to the sentinel, so the
  --    board's owners retain control without crediting a real person. (Solo
  --    boards are already gone; their items went with them.)
  update public.items set created_by = sentinel where created_by = uid;

  -- 5. boards.created_by is provenance with an ON DELETE RESTRICT guard. Hand
  --    any surviving board I created to a remaining owner (fallback: sentinel,
  --    though every surviving board has a real owner by now).
  update public.boards b
     set created_by = coalesce(
       (select m.user_id from public.memberships m
        where m.board_id = b.id and m.role = 'owner' and m.user_id <> uid
        limit 1),
       sentinel)
   where b.created_by = uid;

  -- 6. Removing the auth user cascades my remaining memberships and profile;
  --    assignments to me on others' items clear via the assignee_id FK. No
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
