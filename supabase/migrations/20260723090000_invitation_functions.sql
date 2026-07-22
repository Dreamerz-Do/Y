-- Invitation flow (spec 4.4).
--
-- Invitations go to the email address of an *existing* account; there are no
-- pending invitations for unknown addresses. Both the existence check and the
-- acceptance need to touch tables the invited user has no direct rights on
-- (auth.users, and memberships before they are a member), so they run through
-- SECURITY DEFINER functions with a narrow, audited surface — never by relaxing
-- an RLS policy (hard rule 2 / spec 9.9).
--
-- Layout:
--   1. create_invitation  — owner-only, validates the email is a known account
--   2. accept_invitation  — invitee-only, creates the membership
--   3. my_pending_invitations — the invitee's own outstanding invitations,
--      with the board name they otherwise could not read yet

begin;

-- ---------------------------------------------------------------------------
-- 1. create_invitation
--
-- Only a board owner may invite (spec 4.2). The target must already have an
-- account; if not, the call fails with a clear message (spec 4.4) rather than
-- leaving a pending invitation for an address nobody owns. Re-inviting an
-- address resets the row to pending.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  b uuid,
  target_email text,
  target_role public.board_role default 'member'
)
returns public.invitations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid;
  inv public.invitations;
begin
  if not public.is_board_owner(b) then
    raise exception 'only owners may invite members';
  end if;

  select id into target_user from auth.users where lower(email) = lower(target_email);
  if target_user is null then
    raise exception 'no account exists for that email address';
  end if;

  if exists (
    select 1 from public.memberships
    where board_id = b and user_id = target_user
  ) then
    raise exception 'that account is already a member of this board';
  end if;

  insert into public.invitations (board_id, email, role, invited_by, status)
  values (b, lower(target_email), target_role, auth.uid(), 'pending')
  on conflict (board_id, email)
    do update set role = excluded.role, status = 'pending', invited_by = auth.uid()
  returning * into inv;

  return inv;
end;
$$;

revoke all on function public.create_invitation(uuid, text, public.board_role) from anon;
grant execute on function public.create_invitation(uuid, text, public.board_role) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. accept_invitation
--
-- Only the invited account may accept, and only while the invitation is
-- pending. Accepting creates the membership at the invited role; the caller is
-- not yet an owner, so the memberships INSERT policy could not allow this on
-- its own — hence the definer function. Declining is a plain status update the
-- invitee is already allowed to make through RLS.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(inv uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.invitations;
  my_email text;
begin
  select * into invitation from public.invitations where id = inv;
  -- "not found" and "not yours" are answered the same way (hard rule 5).
  if invitation is null then
    raise exception 'invitation not found';
  end if;

  my_email := lower(auth.jwt() ->> 'email');
  if lower(invitation.email) <> my_email then
    raise exception 'invitation not found';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'invitation is no longer pending';
  end if;

  insert into public.memberships (board_id, user_id, role)
  values (invitation.board_id, auth.uid(), invitation.role)
  on conflict (board_id, user_id) do nothing;

  update public.invitations set status = 'accepted' where id = inv;
end;
$$;

revoke all on function public.accept_invitation(uuid) from anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. my_pending_invitations
--
-- The invitee can already select their own invitation rows (invitations_select
-- policy), but not the board they point at — they are not a member yet. This
-- definer view exposes only the board *name* alongside the invitation, nothing
-- else about the board, so the accept/decline screen can be rendered.
-- ---------------------------------------------------------------------------
create view public.my_pending_invitations
  with (security_invoker = off, security_barrier = true)
as
  select
    i.id,
    i.board_id,
    b.name as board_name,
    i.role,
    i.created_at
  from public.invitations i
  join public.boards b on b.id = i.board_id
  where i.status = 'pending'
    and lower(i.email) = lower(auth.jwt() ->> 'email');

revoke all on public.my_pending_invitations from anon;
grant select on public.my_pending_invitations to authenticated;

commit;
