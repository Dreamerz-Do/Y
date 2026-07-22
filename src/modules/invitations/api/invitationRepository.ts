import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables, Views } from '@/shared/types/database'
import type { Role } from '@/modules/boards/types/board'
import type { Invitation, PendingInvitation } from '../types/invitation'

// Only place with Supabase calls for invitations (spec 6.3). The invite and
// accept flows go through SECURITY DEFINER RPCs (create_invitation /
// accept_invitation) because they touch tables the caller has no direct rights
// on; declining is a plain, RLS-allowed status update.

export function mapInvitation(row: Tables<'invitations'>): Invitation {
  return {
    id: row.id,
    boardId: row.board_id,
    email: row.email,
    role: row.role,
    status: row.status,
  }
}

export function mapPending(row: Views<'my_pending_invitations'>): PendingInvitation {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    boardName: row.board_name ?? 'Onbekend board',
    role: (row.role ?? 'member') as Role,
  }
}

export const invitationRepository = {
  /** Invitations sent on a board — owner-only by RLS. Board-scoped. */
  async listForBoard(boardId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at')
    if (error) throw error
    return (data ?? []).map(mapInvitation)
  },

  /** The caller's own outstanding invitations, with each board's name. */
  async listMine(): Promise<PendingInvitation[]> {
    const { data, error } = await supabase.from('my_pending_invitations').select('*')
    if (error) throw error
    return (data ?? []).map(mapPending)
  },

  /**
   * Invite an existing account by email. Fails clearly if no account owns the
   * address (spec 4.4) — that check lives in the RPC, not the client.
   */
  async create(boardId: string, email: string, role: Role): Promise<void> {
    const { error } = await supabase.rpc('create_invitation', {
      b: boardId,
      target_email: email,
      target_role: role,
    })
    if (error) throw error
  },

  async accept(invitationId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_invitation', { inv: invitationId })
    if (error) throw error
  },

  async decline(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId)
    if (error) throw error
  },

  /** Withdraw an invitation — owner-only by RLS. */
  async remove(invitationId: string): Promise<void> {
    const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
    if (error) throw error
  },
}
