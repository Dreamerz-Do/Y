import { describe, it, expect } from 'vitest'
import {
  emptyForm,
  itemToForm,
  formToNewItem,
  formToPatch,
  formToAudience,
  isSaveable,
  type ItemForm,
} from './itemForm'
import type { Item } from '../types/item'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    boardId: 'b1',
    title: 'Tandarts',
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

describe('emptyForm', () => {
  it('adopts the board default visibility', () => {
    // Arrange + Act
    const form = emptyForm('private')

    // Assert
    expect(form.visibility).toBe('private')
  })
})

describe('formToNewItem', () => {
  it('produces a dateless to-do when hasDate is off', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), title: '  Boodschappen  ', hasDate: false }

    // Act
    const input = formToNewItem(form, 'b1')

    // Assert
    expect(input).toMatchObject({ boardId: 'b1', title: 'Boodschappen', startsAt: null, endsAt: null, allDay: false })
  })

  it('resolves a timed item to UTC instants', () => {
    // Arrange
    const form: ItemForm = {
      ...emptyForm(),
      title: 'Zwemles',
      hasDate: true,
      allDay: false,
      date: '2026-07-15',
      startTime: '17:00',
      endTime: '17:45',
    }

    // Act
    const input = formToNewItem(form, 'b1')

    // Assert
    expect(input.startsAt).toBe('2026-07-15T15:00:00.000Z')
    expect(input.endsAt).toBe('2026-07-15T15:45:00.000Z')
  })
})

describe('formToPatch', () => {
  it('carries an all-day flag only when a date is set', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), title: 'X', hasDate: false, allDay: true }

    // Act
    const patch = formToPatch(form)

    // Assert
    expect(patch.allDay).toBe(false)
  })
})

describe('formToAudience', () => {
  it('is empty for a non-shared item', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), visibility: 'private', audienceMemberIds: ['m1'] }

    // Act
    const audience = formToAudience(form)

    // Assert
    expect(audience).toEqual({ memberIds: [], groupIds: [] })
  })

  it('carries members and groups for a shared_with item', () => {
    // Arrange
    const form: ItemForm = {
      ...emptyForm(),
      visibility: 'shared_with',
      audienceMemberIds: ['m1'],
      audienceGroupIds: ['g1'],
    }

    // Act
    const audience = formToAudience(form)

    // Assert
    expect(audience).toEqual({ memberIds: ['m1'], groupIds: ['g1'] })
  })
})

describe('itemToForm', () => {
  it('round-trips a timed item back to wall-clock fields', () => {
    // Arrange
    const item = makeItem({ startsAt: '2026-07-15T15:00:00.000Z', endsAt: '2026-07-15T15:45:00.000Z' })

    // Act
    const form = itemToForm(item)

    // Assert
    expect(form).toMatchObject({ hasDate: true, date: '2026-07-15', startTime: '17:00', endTime: '17:45' })
  })
})

describe('isSaveable', () => {
  it('rejects an empty title', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), title: '   ' }

    // Act
    const ok = isSaveable(form)

    // Assert
    expect(ok).toBe(false)
  })

  it('rejects a shared_with item with no audience', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), title: 'X', visibility: 'shared_with' }

    // Act
    const ok = isSaveable(form)

    // Assert
    expect(ok).toBe(false)
  })

  it('rejects an end time before the start time', () => {
    // Arrange
    const form: ItemForm = {
      ...emptyForm(),
      title: 'X',
      hasDate: true,
      allDay: false,
      startTime: '10:00',
      endTime: '09:00',
    }

    // Act
    const ok = isSaveable(form)

    // Assert
    expect(ok).toBe(false)
  })

  it('accepts a valid title-only item', () => {
    // Arrange
    const form: ItemForm = { ...emptyForm(), title: 'Boodschappen' }

    // Act
    const ok = isSaveable(form)

    // Assert
    expect(ok).toBe(true)
  })
})
