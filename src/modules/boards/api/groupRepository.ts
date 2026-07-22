import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables, TablesInsert } from '@/shared/types/database'
import type { Group } from '../types/board'

// Only place with Supabase calls for groups (spec 6.3). Groups are an audience,
// not a permission level (spec 4.3): any board member may read them, only an
// owner may manage them — enforced by RLS, not here.

interface GroupRow extends Tables<'groups'> {
  group_members: { membership_id: string }[] | null
}

export function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    memberIds: (row.group_members ?? []).map((gm) => gm.membership_id),
  }
}

export const groupRepository = {
  /** Groups on a board, each with its member ids. Board-scoped by construction. */
  async listByBoard(boardId: string): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('id,board_id,name,created_at,group_members(membership_id)')
      .eq('board_id', boardId)
      .order('created_at')
    if (error) throw error
    return ((data ?? []) as unknown as GroupRow[]).map(mapGroup)
  },

  async create(boardId: string, name: string): Promise<Group> {
    const payload: TablesInsert<'groups'> = { board_id: boardId, name }
    const { data, error } = await supabase
      .from('groups')
      .insert(payload)
      .select('id,board_id,name,created_at')
      .single()
    if (error) throw error
    return mapGroup({ ...(data as Tables<'groups'>), group_members: [] })
  },

  async rename(groupId: string, name: string): Promise<void> {
    const { error } = await supabase.from('groups').update({ name }).eq('id', groupId)
    if (error) throw error
  },

  async remove(groupId: string): Promise<void> {
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) throw error
  },

  /**
   * Replace a group's membership wholesale: clear the existing rows and insert
   * the given memberships. Keeps the group's audience in one atomic-feeling call.
   */
  async setMembers(groupId: string, membershipIds: string[]): Promise<void> {
    const { error: delError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
    if (delError) throw delError
    if (!membershipIds.length) return
    const rows: TablesInsert<'group_members'>[] = membershipIds.map((membership_id) => ({
      group_id: groupId,
      membership_id,
    }))
    const { error } = await supabase.from('group_members').insert(rows)
    if (error) throw error
  },
}
