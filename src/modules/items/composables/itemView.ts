import type { Member } from '@/modules/boards/types/board'
import type { AvatarView, BusyBlock, Item, ItemRowView } from '../types/item'

/**
 * Pure presentation helpers: map a domain Item (or a BusyBlock) to the view
 * model an ItemRow renders. No Supabase, no side effects — trivially testable.
 *
 * Visibility itself is NOT decided here. The database has already filtered what
 * this user may see (RLS, hard rule 2); private items owned by others never
 * arrive as Items at all — they arrive as BusyBlocks through a separate,
 * content-free projection. Deciding visibility in the client would be a bug.
 */

// Fixed to the household's region (spec: all infrastructure in Western Europe)
// so times read consistently and formatting is deterministic in tests. A
// per-user timezone is a later refinement.
const HHMM = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam',
})

/** "17:00–17:45", or "Hele dag", or null for a dateless to-do. */
export function timeLabel(item: Pick<Item, 'startsAt' | 'endsAt' | 'allDay'>): string | null {
  if (!item.startsAt) return null
  if (item.allDay) return 'Hele dag'
  const start = HHMM.format(new Date(item.startsAt))
  if (!item.endsAt) return start
  return `${start}–${HHMM.format(new Date(item.endsAt))}`
}

function avatarsFor(memberIds: string[], members: Member[]): AvatarView[] {
  return memberIds
    .map((id) => members.find((m) => m.membershipId === id))
    .filter((m): m is Member => Boolean(m))
    .map((m) => ({ initial: m.name.charAt(0).toUpperCase(), hue: m.hue }))
}

/** Which badge, if any, a visible item deserves (spec 7.7: only deviations). */
export function badgeFor(item: Item): ItemRowView['badge'] {
  if (item.visibility === 'private') return 'lock'
  if (item.visibility === 'shared_with') return 'subset'
  return null // board-wide is the norm and gets no marker
}

export function toRowView(item: Item, members: Member[]): ItemRowView {
  return {
    id: item.id,
    isBusy: false,
    title: item.title,
    timeLabel: timeLabel(item),
    recurring: null, // recurrence is outside the MVP (spec 3.5.2)
    done: item.isDone,
    badge: badgeFor(item),
    color: item.color,
    ownerName: null,
    assignees: avatarsFor(item.assigneeIds, members),
  }
}

export function busyBlockToRowView(block: BusyBlock): ItemRowView {
  return {
    id: block.id,
    isBusy: true,
    title: null,
    timeLabel: timeLabel(block),
    recurring: null,
    done: false,
    badge: null,
    color: null,
    ownerName: block.ownerName,
    assignees: [],
  }
}
