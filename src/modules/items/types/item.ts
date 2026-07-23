import type { ItemColorKey } from '@/shared/lib/palette'

/** Visibility axes per item (spec 4.6). */
export type Visibility = 'board' | 'private' | 'shared_with'

/**
 * An item as the domain layer works with it — mapped from the generated
 * database row by the repository. Distinct from the raw DB type so the UI is
 * insulated from column naming.
 */
export interface Item {
  id: string
  boardId: string
  title: string
  notes: string | null
  assigneeIds: string[]
  startsAt: string | null
  endsAt: string | null
  allDay: boolean
  isDone: boolean
  visibility: Visibility
  revealOwner: boolean
  color: ItemColorKey | null
  createdBy: string
  createdAt: string
}

/**
 * A busy block — the contentless projection of someone else's private dated
 * item (spec 3.2). It carries no title, notes or participants, by construction:
 * those columns never leave the database.
 */
export interface BusyBlock {
  id: string
  boardId: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  ownerName: string | null
}

/** A member avatar as rendered on a row: initial + colour, never colour alone. */
export interface AvatarView {
  initial: string
  hue: number
}

/** The view model an ItemRow renders. Either a real row or a busy block. */
export interface ItemRowView {
  id: string
  isBusy: boolean
  title: string | null
  timeLabel: string | null
  recurring: string | null
  done: boolean
  badge: 'lock' | 'subset' | null
  color: ItemColorKey | null
  ownerName: string | null
  assignees: AvatarView[]
}
