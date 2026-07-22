-- Initial schema for the household organiser.
--
-- Everything here follows the spec:
--   * every query is board-scoped, authorisation is always (user, board)  [hard rule 1]
--   * visibility is enforced in the database through RLS                  [hard rule 2]
--   * "not found" and "no access" are indistinguishable — RLS just hides  [6.8]
--
-- Layout of this file:
--   1. enums
--   2. tables
--   3. helper functions (SECURITY DEFINER, to keep RLS non-recursive)
--   4. triggers
--   5. row level security policies (the authorisation matrix, 4.2)
--   6. the busy-block projection (3.2)

begin;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

create type public.board_role as enum ('owner', 'member', 'guest');
create type public.item_visibility as enum ('board', 'private', 'shared_with');
create type public.invitation_status as enum ('pending', 'accepted', 'declined');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Public mirror of auth.users. auth.users is not directly joinable under RLS,
-- so display data lives here. No email is stored — that is personal data and
-- lookups happen through a SECURITY DEFINER function instead.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  color_hue smallint,
  created_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  accent_hue smallint not null default 215,
  -- Default audience for new items on this board (spec 4.3).
  default_visibility public.item_visibility not null default 'board',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.board_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_board_idx on public.memberships (board_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create index groups_board_idx on public.groups (board_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  primary key (group_id, membership_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  assignee_id uuid references public.memberships (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  is_done boolean not null default false,
  visibility public.item_visibility not null default 'board',
  reveal_owner boolean not null default true,
  color text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A dated item is a calendar item; a dateless one is a to-do (spec 3.1).
  constraint items_end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index items_board_idx on public.items (board_id);
create index items_assignee_idx on public.items (assignee_id);
create index items_creator_idx on public.items (created_by);

-- Explicit audience for shared_with items. Exactly one of member/group per row.
create table public.item_shares (
  item_id uuid not null references public.items (id) on delete cascade,
  membership_id uuid references public.memberships (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  constraint item_shares_one_target check (
    (membership_id is not null)::int + (group_id is not null)::int = 1
  ),
  unique (item_id, membership_id, group_id)
);

create index item_shares_item_idx on public.item_shares (item_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  email text not null,
  role public.board_role not null default 'member',
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (board_id, email)
);

create index invitations_email_idx on public.invitations (lower(email));

-- ---------------------------------------------------------------------------
-- 3. Helper functions
--
-- SECURITY DEFINER so a policy on `items` can consult `memberships` without
-- triggering that table's own RLS (which would recurse). They read only the
-- current user's rows, so they leak nothing.
-- ---------------------------------------------------------------------------

create or replace function public.is_board_member(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where board_id = b and user_id = auth.uid()
  );
$$;

create or replace function public.board_role_of(b uuid)
returns public.board_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.memberships
  where board_id = b and user_id = auth.uid();
$$;

create or replace function public.is_board_owner(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.board_role_of(b) = 'owner';
$$;

-- May the current user edit other members' items on this board?
-- Owners and members yes, guests no (spec 4.2).
create or replace function public.can_edit_others(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.board_role_of(b) in ('owner', 'member');
$$;

-- The current user's membership id on a board (used for assignment/shares).
create or replace function public.my_membership_id(b uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.memberships
  where board_id = b and user_id = auth.uid();
$$;

-- Number of owners on a board — used to guarantee at least one remains.
create or replace function public.owner_count(b uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from public.memberships
  where board_id = b and role = 'owner';
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- Keep updated_at honest on items.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

-- Create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a board becomes its first owner.
create or replace function public.handle_new_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (board_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_board_created
  after insert on public.boards
  for each row execute function public.handle_new_board();

-- A board must always keep at least one owner (spec 4.2 / 4.5).
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_board uuid;
begin
  target_board := coalesce(old.board_id, new.board_id);
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

create trigger memberships_guard_last_owner
  before update or delete on public.memberships
  for each row execute function public.guard_last_owner();

-- Assigning an item to *another* member requires owner/member (spec 4.2).
-- A guest may still create items and assign them to themselves.
create or replace function public.guard_item_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assignee_id is not null
     and new.assignee_id <> public.my_membership_id(new.board_id)
     and not public.can_edit_others(new.board_id) then
    raise exception 'only owners and members may assign items to others';
  end if;
  return new;
end;
$$;

create trigger items_guard_assignment
  before insert or update on public.items
  for each row execute function public.guard_item_assignment();

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.items enable row level security;
alter table public.item_shares enable row level security;
alter table public.invitations enable row level security;

-- profiles: read your own, plus anyone who shares a board with you.
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.board_id = mine.board_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- boards
create policy boards_select on public.boards
  for select using (public.is_board_member(id));

create policy boards_insert on public.boards
  for insert with check (created_by = auth.uid());

create policy boards_update on public.boards
  for update using (public.is_board_owner(id)) with check (public.is_board_owner(id));

create policy boards_delete on public.boards
  for delete using (public.is_board_owner(id));

-- memberships
create policy memberships_select on public.memberships
  for select using (public.is_board_member(board_id));

-- Owners manage members; the creator's first owner row is added by a
-- SECURITY DEFINER trigger so it does not need an insert policy for the user.
create policy memberships_insert on public.memberships
  for insert with check (public.is_board_owner(board_id));

create policy memberships_update on public.memberships
  for update using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

-- Owners remove anyone; a member may remove themselves (leaving, spec 4.5).
create policy memberships_delete on public.memberships
  for delete using (public.is_board_owner(board_id) or user_id = auth.uid());

-- groups: any board member may read (they are an audience); owners manage.
create policy groups_select on public.groups
  for select using (public.is_board_member(board_id));

create policy groups_insert on public.groups
  for insert with check (public.is_board_owner(board_id));

create policy groups_update on public.groups
  for update using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

create policy groups_delete on public.groups
  for delete using (public.is_board_owner(board_id));

-- group_members: readable by board members, managed by owners.
create policy group_members_select on public.group_members
  for select using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_board_member(g.board_id))
  );

create policy group_members_insert on public.group_members
  for insert with check (
    exists (select 1 from public.groups g where g.id = group_id and public.is_board_owner(g.board_id))
  );

create policy group_members_delete on public.group_members
  for delete using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_board_owner(g.board_id))
  );

-- items: the visibility model (spec 3.2 / 4.2). This SELECT policy is the
-- single most important rule in the schema.
create policy items_select on public.items
  for select using (
    public.is_board_member(board_id)
    and (
      -- your own items, always
      created_by = auth.uid()
      -- board-wide items, but not for guests
      or (visibility = 'board' and public.can_edit_others(board_id))
      -- items assigned to you, whatever your role
      or assignee_id = public.my_membership_id(board_id)
      -- explicitly shared with you, directly or through a group
      or (
        visibility = 'shared_with'
        and (
          exists (
            select 1 from public.item_shares s
            where s.item_id = items.id
              and s.membership_id = public.my_membership_id(board_id)
          )
          or exists (
            select 1 from public.item_shares s
            join public.group_members gm on gm.group_id = s.group_id
            where s.item_id = items.id
              and gm.membership_id = public.my_membership_id(board_id)
          )
        )
      )
    )
  );

create policy items_insert on public.items
  for insert with check (
    public.is_board_member(board_id) and created_by = auth.uid()
  );

-- Edit own items always; edit others' only as owner/member.
create policy items_update on public.items
  for update using (
    public.is_board_member(board_id)
    and (created_by = auth.uid() or public.can_edit_others(board_id))
  ) with check (
    public.is_board_member(board_id)
    and (created_by = auth.uid() or public.can_edit_others(board_id))
  );

create policy items_delete on public.items
  for delete using (
    public.is_board_member(board_id)
    and (created_by = auth.uid() or public.can_edit_others(board_id))
  );

-- item_shares: visible to board members; managed by whoever can edit the item.
create policy item_shares_select on public.item_shares
  for select using (
    exists (select 1 from public.items i where i.id = item_id and public.is_board_member(i.board_id))
  );

create policy item_shares_insert on public.item_shares
  for insert with check (
    exists (
      select 1 from public.items i
      where i.id = item_id
        and public.is_board_member(i.board_id)
        and (i.created_by = auth.uid() or public.can_edit_others(i.board_id))
    )
  );

create policy item_shares_delete on public.item_shares
  for delete using (
    exists (
      select 1 from public.items i
      where i.id = item_id
        and public.is_board_member(i.board_id)
        and (i.created_by = auth.uid() or public.can_edit_others(i.board_id))
    )
  );

-- invitations: an owner manages them; the invited user sees their own by email.
create policy invitations_select on public.invitations
  for select using (
    public.is_board_owner(board_id)
    or lower(email) = lower((auth.jwt() ->> 'email'))
  );

create policy invitations_insert on public.invitations
  for insert with check (public.is_board_owner(board_id) and invited_by = auth.uid());

create policy invitations_update on public.invitations
  for update using (
    lower(email) = lower((auth.jwt() ->> 'email')) or public.is_board_owner(board_id)
  ) with check (
    lower(email) = lower((auth.jwt() ->> 'email')) or public.is_board_owner(board_id)
  );

create policy invitations_delete on public.invitations
  for delete using (public.is_board_owner(board_id));

-- ---------------------------------------------------------------------------
-- 6. Busy-block projection (spec 3.2)
--
-- A private, dated item claims time in other members' calendars as a
-- contentless block: only the time slot and, if reveal_owner, the owner's
-- name. The base items policy hides private items from everyone but the
-- owner, so the block cannot come from that table. This view runs with the
-- definer's rights (security_invoker = off) and exposes ONLY neutral columns
-- for private dated items on boards where the caller is a member. No title,
-- notes, location or participants ever leave the database. This is route 2
-- from spec 3.3.
-- ---------------------------------------------------------------------------

create view public.calendar_busy_blocks
  with (security_invoker = off, security_barrier = true)
as
  select
    i.id,
    i.board_id,
    i.starts_at,
    i.ends_at,
    i.all_day,
    case when i.reveal_owner then p.display_name else null end as owner_name,
    case when i.reveal_owner then i.created_by else null end as owner_id
  from public.items i
  join public.profiles p on p.id = i.created_by
  where i.visibility = 'private'
    and i.starts_at is not null
    and i.created_by <> auth.uid()
    and public.is_board_member(i.board_id);

revoke all on public.calendar_busy_blocks from anon;
grant select on public.calendar_busy_blocks to authenticated;

commit;
