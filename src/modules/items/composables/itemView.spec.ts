import { describe, it, expect } from 'vitest'
import { badgeFor, busyBlockToRowView, timeLabel, toRowView } from './itemView'
import type { BusyBlock, Item } from '../types/item'
import type { Member } from '@/modules/boards/types/board'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    boardId: 'b1',
    title: 'Boodschappen doen',
    notes: null,
    assigneeIds: [],
    startsAt: null,
    endsAt: null,
    allDay: false,
    isDone: false,
    visibility: 'board',
    revealOwner: true,
    color: null,
    createdBy: 'u1',
    ...overrides,
  }
}

const members: Member[] = [
  { membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 255 },
  { membershipId: 'm2', userId: 'u2', name: 'Laura', role: 'owner', hue: 10 },
]

describe('timeLabel', () => {
  it('returns null for a dateless to-do', () => {
    // Arrange
    const item = makeItem({ startsAt: null })

    // Act
    const label = timeLabel(item)

    // Assert
    expect(label).toBeNull()
  })

  it('returns "Hele dag" for an all-day item', () => {
    // Arrange
    const item = makeItem({ startsAt: '2026-04-02T00:00:00+02:00', allDay: true })

    // Act
    const label = timeLabel(item)

    // Assert
    expect(label).toBe('Hele dag')
  })

  it('formats a start–end range', () => {
    // Arrange
    const item = makeItem({
      startsAt: '2026-04-02T17:00:00+02:00',
      endsAt: '2026-04-02T17:45:00+02:00',
    })

    // Act
    const label = timeLabel(item)

    // Assert
    expect(label).toBe('17:00–17:45')
  })
})

describe('badgeFor', () => {
  it('marks a private item with a lock', () => {
    // Arrange
    const item = makeItem({ visibility: 'private' })

    // Act
    const badge = badgeFor(item)

    // Assert
    expect(badge).toBe('lock')
  })

  it('marks a shared_with item as subset', () => {
    // Arrange
    const item = makeItem({ visibility: 'shared_with' })

    // Act
    const badge = badgeFor(item)

    // Assert
    expect(badge).toBe('subset')
  })

  it('leaves a board-wide item unmarked', () => {
    // Arrange
    const item = makeItem({ visibility: 'board' })

    // Act
    const badge = badgeFor(item)

    // Assert
    expect(badge).toBeNull()
  })
})

describe('toRowView', () => {
  it('resolves assignee avatars from membership ids', () => {
    // Arrange
    const item = makeItem({ assigneeIds: ['m2'] })

    // Act
    const view = toRowView(item, members)

    // Assert
    expect(view.assignees).toEqual([{ initial: 'L', hue: 10 }])
  })
})

describe('busyBlockToRowView', () => {
  it('carries only the time slot and owner, never a title', () => {
    // Arrange
    const block: BusyBlock = {
      id: 'x1',
      boardId: 'b1',
      startsAt: '2026-04-01T10:30:00+02:00',
      endsAt: '2026-04-01T11:15:00+02:00',
      allDay: false,
      ownerName: 'Laura',
    }

    // Act
    const view = busyBlockToRowView(block)

    // Assert
    expect(view).toMatchObject({ isBusy: true, title: null, ownerName: 'Laura', timeLabel: '10:30–11:15' })
  })
})
