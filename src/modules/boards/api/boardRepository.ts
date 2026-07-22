import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables, TablesInsert } from '@/shared/types/database'
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload: TablesInsert<'boards'> = { name, accent_hue: accentHue, created_by: user.id }
    const { data, error } = await supabase.from('boards').insert(payload).select('*').single()
    if (error) throw error
    return mapBoard(data)
  },

  async members(boardId: string): Promise<Member[]> {
    const { data, error } = await supabase
      .from('memberships')
      .select('id,user_id,role,profiles(display_name,color_hue)')
      .eq('board_id', boardId)
    if (error) throw error
    return ((data ?? []) as unknown as MembershipWithProfile[]).map(mapMember)
  },
}
