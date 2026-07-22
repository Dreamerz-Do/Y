import type { ItemColorKey } from '@/shared/lib/palette'
import type { ItemPatch, NewItem, ShareTargets } from '../api/itemRepository'
import type { Item, Visibility } from '../types/item'
import { allDayRange, splitIso, toUtcIso, todayInZone } from './itemDateTime'

/**
 * The editor's form model and the pure mappings between it and the repository
 * inputs. Kept free of Vue and Supabase so every branch is unit-testable
 * (spec 9.5). Visibility itself is never decided here — the database enforces
 * it (hard rule 2); this only records the owner's choice.
 */
export interface ItemForm {
  title: string
  notes: string
  hasDate: boolean
  allDay: boolean
  date: string // yyyy-mm-dd
  startTime: string // HH:mm
  endTime: string // HH:mm, empty for open-ended
  assigneeId: string | null // membership id, or null for unassigned
  color: ItemColorKey | null
  visibility: Visibility
  revealOwner: boolean
  audienceMemberIds: string[]
  audienceGroupIds: string[]
}

/** A blank form for a new item; visibility falls back to the board default. */
export function emptyForm(defaultVisibility: Visibility = 'board'): ItemForm {
  return {
    title: '',
    notes: '',
    hasDate: false,
    allDay: false,
    date: todayInZone(),
    startTime: '09:00',
    endTime: '',
    assigneeId: null,
    color: null,
    visibility: defaultVisibility,
    revealOwner: true,
    audienceMemberIds: [],
    audienceGroupIds: [],
  }
}

/** Prefill a form from an existing item (its audience is loaded separately). */
export function itemToForm(item: Item, audience?: ShareTargets): ItemForm {
  const start = item.startsAt ? splitIso(item.startsAt) : null
  const end = item.endsAt ? splitIso(item.endsAt) : null
  return {
    title: item.title,
    notes: item.notes ?? '',
    hasDate: Boolean(item.startsAt),
    allDay: item.allDay,
    date: start?.date ?? todayInZone(),
    startTime: start?.time ?? '09:00',
    endTime: item.allDay ? '' : (end?.time ?? ''),
    assigneeId: item.assigneeIds[0] ?? null,
    color: item.color,
    visibility: item.visibility,
    revealOwner: item.revealOwner,
    audienceMemberIds: audience?.memberIds ?? [],
    audienceGroupIds: audience?.groupIds ?? [],
  }
}

/** The two UTC timestamps a form's date section resolves to. */
function timesFromForm(form: ItemForm): { startsAt: string | null; endsAt: string | null } {
  if (!form.hasDate) return { startsAt: null, endsAt: null }
  if (form.allDay) {
    const range = allDayRange(form.date)
    return { startsAt: range.startsAt, endsAt: range.endsAt }
  }
  const startsAt = toUtcIso(form.date, form.startTime)
  const endsAt = form.endTime ? toUtcIso(form.date, form.endTime) : null
  return { startsAt, endsAt }
}

export function formToNewItem(form: ItemForm, boardId: string): NewItem {
  const { startsAt, endsAt } = timesFromForm(form)
  return {
    boardId,
    title: form.title.trim(),
    notes: form.notes.trim() || null,
    startsAt,
    endsAt,
    allDay: form.hasDate && form.allDay,
    assigneeId: form.assigneeId,
    color: form.color,
    visibility: form.visibility,
    revealOwner: form.revealOwner,
  }
}

export function formToPatch(form: ItemForm): ItemPatch {
  const { startsAt, endsAt } = timesFromForm(form)
  return {
    title: form.title.trim(),
    notes: form.notes.trim() || null,
    startsAt,
    endsAt,
    allDay: form.hasDate && form.allDay,
    assigneeId: form.assigneeId,
    color: form.color,
    visibility: form.visibility,
    revealOwner: form.revealOwner,
  }
}

/** The audience is only carried for shared_with items; empty otherwise. */
export function formToAudience(form: ItemForm): ShareTargets {
  if (form.visibility !== 'shared_with') return { memberIds: [], groupIds: [] }
  return { memberIds: [...form.audienceMemberIds], groupIds: [...form.audienceGroupIds] }
}

/** Whether the form may be saved: a title is the only hard requirement (spec 3.5.1). */
export function isSaveable(form: ItemForm): boolean {
  if (!form.title.trim()) return false
  // A timed item with both ends set must not end before it starts.
  if (form.hasDate && !form.allDay && form.endTime && form.endTime < form.startTime) return false
  // A shared_with item with no audience would be visible to nobody but the owner.
  if (form.visibility === 'shared_with' && !form.audienceMemberIds.length && !form.audienceGroupIds.length) {
    return false
  }
  return true
}
