import { supabase } from '@/shared/lib/supabaseClient'
import type { Tables, TablesInsert, TablesUpdate, Views } from '@/shared/types/database'
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
  notes?: string | null
  startsAt?: string | null
  endsAt?: string | null
  allDay?: boolean
  assigneeId?: string | null
  color?: ItemColorKey | null
  visibility?: Visibility
  revealOwner?: boolean
}

/** A partial edit of an existing item. Every field is optional. */
export interface ItemPatch {
  title?: string
  notes?: string | null
  startsAt?: string | null
  endsAt?: string | null
  allDay?: boolean
  assigneeId?: string | null
  color?: ItemColorKey | null
  visibility?: Visibility
  revealOwner?: boolean
  isDone?: boolean
}

/** The audience of a shared_with item: explicit members and/or groups. */
export interface ShareTargets {
  memberIds: string[]
  groupIds: string[]
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

  /** A single item the caller may see, or null. RLS decides visibility. */
  async get(itemId: string): Promise<Item | null> {
    const { data, error } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle()
    if (error) throw error
    return data ? mapRow(data) : null
  },

  /** Apply a partial edit. RLS enforces who may edit which item (spec 4.2). */
  async update(itemId: string, patch: ItemPatch): Promise<Item> {
    const payload: TablesUpdate<'items'> = {}
    if (patch.title !== undefined) payload.title = patch.title
    if (patch.notes !== undefined) payload.notes = patch.notes
    if (patch.startsAt !== undefined) payload.starts_at = patch.startsAt
    if (patch.endsAt !== undefined) payload.ends_at = patch.endsAt
    if (patch.allDay !== undefined) payload.all_day = patch.allDay
    if (patch.assigneeId !== undefined) payload.assignee_id = patch.assigneeId
    if (patch.color !== undefined) payload.color = patch.color
    if (patch.visibility !== undefined) payload.visibility = patch.visibility
    if (patch.revealOwner !== undefined) payload.reveal_owner = patch.revealOwner
    if (patch.isDone !== undefined) payload.is_done = patch.isDone
    const { data, error } = await supabase
      .from('items')
      .update(payload)
      .eq('id', itemId)
      .select('*')
      .single()
    if (error) throw error
    return mapRow(data)
  },

  /** The explicit audience of a shared_with item (spec 3.2 / 4.3). */
  async sharesByItem(itemId: string): Promise<ShareTargets> {
    const { data, error } = await supabase
      .from('item_shares')
      .select('membership_id,group_id')
      .eq('item_id', itemId)
    if (error) throw error
    const memberIds: string[] = []
    const groupIds: string[] = []
    for (const row of data ?? []) {
      if (row.membership_id) memberIds.push(row.membership_id)
      if (row.group_id) groupIds.push(row.group_id)
    }
    return { memberIds, groupIds }
  },

  /**
   * Replace an item's audience wholesale: clear the existing shares and insert
   * the given members and groups. Called only for shared_with items; the caller
   * passes empty arrays for every other visibility so no stale rows linger.
   */
  async replaceShares(itemId: string, targets: ShareTargets): Promise<void> {
    const { error: delError } = await supabase.from('item_shares').delete().eq('item_id', itemId)
    if (delError) throw delError
    const rows: TablesInsert<'item_shares'>[] = [
      ...targets.memberIds.map((membership_id) => ({ item_id: itemId, membership_id })),
      ...targets.groupIds.map((group_id) => ({ item_id: itemId, group_id })),
    ]
    if (!rows.length) return
    const { error } = await supabase.from('item_shares').insert(rows)
    if (error) throw error
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
