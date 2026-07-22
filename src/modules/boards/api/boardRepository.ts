import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables } from '@/shared/types/database'
import { hueFromId } from '@/shared/lib/palette'
import type { Board, Member, Role } from '../types/board'

// Only place with Supabase calls for the boards domain (spec 6.3). Board list
// is implicitly scoped by RLS to the boards the caller is a member of.

export function mapBoard(row: Tables<'boards'>): Board {
  return {
    id: row.id,
    name: row.name,
    accentHue: row.accent_hue,
    defaultVisibility: row.default_visibility,
    createdBy: row.created_by,
  }
}

interface MembershipWithProfile {
  id: string
  user_id: string
  role: Role
  profiles: { display_name: string; color_hue: number | null } | null
}

export function mapMember(row: MembershipWithProfile): Member {
  const name = row.profiles?.display_name?.trim() || 'Onbekend'
  return {
    membershipId: row.id,
    userId: row.user_id,
    name,
    role: row.role,
    hue: row.profiles?.color_hue ?? hueFromId(row.user_id),
  }
}

export const boardRepository = {
  async list(): Promise<Board[]> {
    const { data, error } = await supabase.from('boards').select('*').order('created_at')
    if (error) throw error
    return (data ?? []).map(mapBoard)
  },

  async get(boardId: string): Promise<Board | null> {
    const { data, error } = await supabase.from('boards').select('*').eq('id', boardId).maybeSingle()
    if (error) throw error
    return data ? mapBoard(data) : null
  },

  async create(name: string, accentHue: number): Promise<Board> {
    // The insert runs inside the create_board SECURITY DEFINER function so the
    // returned row is not gated by the boards SELECT policy — which would
    // otherwise reject it, because the creator's owner membership is only added
    // by the on_board_created AFTER-INSERT trigger and is not visible during a
    // client-side .insert().select() RETURNING. The database still generates the
    // id (spec 6.3: the schema is the source of truth).
    const { data, error } = await supabase.rpc('create_board', {
      board_name: name,
      accent: accentHue,
    })
    if (error) throw error
    return mapBoard(data as Tables<'boards'>)
  },

  async members(boardId: string): Promise<Member[]> {
    const { data, error } = await supabase
      .from('memberships')
      .select('id,user_id,role,profiles(display_name,color_hue)')
      .eq('board_id', boardId)
    if (error) throw error
    return ((data ?? []) as unknown as MembershipWithProfile[]).map(mapMember)
  },

  /** Change a member's role — owner-only by RLS. The last-owner guard (a
   * database trigger) blocks demoting the sole owner (spec 4.2 / 4.5). */
  async updateRole(membershipId: string, role: Role): Promise<void> {
    const { error } = await supabase
      .from('memberships')
      .update({ role })
      .eq('id', membershipId)
    if (error) throw error
  },

  /** Remove a membership. RLS allows an owner to remove anyone, or a member to
   * remove themselves (leaving, spec 4.5); the guard keeps one owner. */
  async removeMember(membershipId: string): Promise<void> {
    const { error } = await supabase.from('memberships').delete().eq('id', membershipId)
    if (error) throw error
  },
}
