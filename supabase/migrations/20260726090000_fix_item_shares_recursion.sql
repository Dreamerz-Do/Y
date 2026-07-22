-- Fix infinite recursion between the items and item_shares policies.
--
-- The items SELECT policy consults item_shares (the shared_with branch), and
-- the item_shares policies consulted items with a plain `select ... from items`
-- — which re-enters the items SELECT policy, which consults item_shares again:
-- Postgres reports "infinite recursion detected in policy for relation
-- item_shares". This is the same trap the initial migration already avoids for
-- memberships with SECURITY DEFINER helpers; item_shares was the one place that
-- still crossed the boundary through RLS.
--
-- The cure is to have the item_shares policies reach items through SECURITY
-- DEFINER functions instead. Those run with the definer's rights and so do not
-- trigger the items RLS, cutting the cycle. They read a single item row, so
-- they leak nothing the caller could not already determine.

begin;

-- The board an item belongs to, without invoking items RLS.
create or replace function public.item_board(i uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select board_id from public.items where id = i;
$$;

-- May the current user edit this item? (Its creator, or an owner/member on the
-- board — spec 4.2.) Reads the item without invoking its RLS.
create or replace function public.can_edit_item(i uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.items it
    where it.id = i
      and public.is_board_member(it.board_id)
      and (it.created_by = auth.uid() or public.can_edit_others(it.board_id))
  );
$$;

-- Rewrite the item_shares policies to use the helpers. Behaviour is identical
-- to the initial migration; only the recursive table reference is removed.
drop policy if exists item_shares_select on public.item_shares;
drop policy if exists item_shares_insert on public.item_shares;
drop policy if exists item_shares_delete on public.item_shares;

create policy item_shares_select on public.item_shares
  for select using (public.is_board_member(public.item_board(item_id)));

create policy item_shares_insert on public.item_shares
  for insert with check (public.can_edit_item(item_id));

create policy item_shares_delete on public.item_shares
  for delete using (public.can_edit_item(item_id));

commit;
