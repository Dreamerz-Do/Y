import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables, TablesInsert, Views } from '@/shared/types/database'
import type { ItemColorKey } from '@/shared/lib/palette'
import type { BusyBlock, Item, Visibility } from '../types/item'

// The repository is the only place that talks to Supabase for items (spec 6.3).
// Every query is board-scoped — authorisation is always (user, board), never
// user alone (hard rule 1). The visibility filtering itself happens in the
// database (RLS); these queries simply ask for a board's rows and receive only
// what the caller may see.

type ItemRow = Tables<'items'>
type BusyRow = Views<'calendar_busy_blocks'>

/** Map a raw database row to the domain Item. Pure — exported for tests. */
export function mapRow(row: ItemRow): Item {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    notes: row.notes,
    assigneeIds: row.assignee_id ? [row.assignee_id] : [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    isDone: row.is_done,
    visibility: row.visibility,
    revealOwner: row.reveal_owner,
    color: (row.color as ItemColorKey | null) ?? null,
    createdBy: row.created_by,
  }
}

function mapBusy(row: BusyRow): BusyBlock {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at,
    allDay: Boolean(row.all_day),
    ownerName: row.owner_name,
  }
}

export interface NewItem {
  boardId: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  allDay?: boolean
  assigneeId?: string | null
  color?: ItemColorKey | null
  visibility?: Visibility
  revealOwner?: boolean
}

export const itemRepository = {
  /** All items on a board the caller may see. Board-scoped by construction. */
  async listByBoard(boardId: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('board_id', boardId)
      .order('starts_at', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map(mapRow)
  },

  /** Content-free busy blocks for others' private dated items on this board. */
  async busyBlocksByBoard(boardId: string): Promise<BusyBlock[]> {
    const { data, error } = await supabase
      .from('calendar_busy_blocks')
      .select('*')
      .eq('board_id', boardId)
    if (error) throw error
    return (data ?? []).map(mapBusy)
  },

  async create(input: NewItem): Promise<Item> {
    // created_by is set from the authenticated user; RLS checks it matches.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const payload: TablesInsert<'items'> = {
      board_id: input.boardId,
      title: input.title,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      all_day: input.allDay ?? false,
      assignee_id: input.assigneeId ?? null,
      color: input.color ?? null,
      visibility: input.visibility ?? 'board',
      reveal_owner: input.revealOwner ?? true,
      created_by: user.id,
    }
    const { data, error } = await supabase.from('items').insert(payload).select('*').single()
    if (error) throw error
    return mapRow(data)
  },

  async setDone(itemId: string, isDone: boolean): Promise<void> {
    const { error } = await supabase.from('items').update({ is_done: isDone }).eq('id', itemId)
    if (error) throw error
  },

  async remove(itemId: string): Promise<void> {
    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (error) throw error
  },
}
