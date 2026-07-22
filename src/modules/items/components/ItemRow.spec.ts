import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemRow from './ItemRow.vue'
import type { ItemRowView } from '../types/item'

function busyRow(): ItemRowView {
  return {
    id: 'x1',
    isBusy: true,
    title: null,
    timeLabel: '10:30–11:15',
    recurring: null,
    done: false,
    badge: null,
    color: null,
    ownerName: 'Laura',
    assignees: [],
  }
}

function normalRow(overrides: Partial<ItemRowView> = {}): ItemRowView {
  return {
    id: 'i1',
    isBusy: false,
    title: 'Boodschappen doen',
    timeLabel: null,
    recurring: null,
    done: false,
    badge: null,
    color: null,
    ownerName: null,
    assignees: [],
    ...overrides,
  }
}

describe('ItemRow busy block', () => {
  it('shows only the time slot and owner, never content', () => {
    // Arrange
    const row = busyRow()

    // Act
    const wrapper = mount(ItemRow, { props: { row } })

    // Assert
    expect(wrapper.text()).toContain('10:30–11:15')
    expect(wrapper.text()).toContain('Bezet')
    expect(wrapper.text()).not.toContain('Boodschappen')
  })

  it('gives the block a spoken time label', () => {
    // Arrange
    const row = busyRow()

    // Act
    const wrapper = mount(ItemRow, { props: { row } })

    // Assert
    expect(wrapper.get('button').attributes('aria-label')).toBe('Bezet, Laura, 10:30 tot 11:15')
  })
})

describe('ItemRow normal row', () => {
  it('renders a lock badge with an accessible label for a private item', () => {
    // Arrange
    const row = normalRow({ badge: 'lock' })

    // Act
    const wrapper = mount(ItemRow, { props: { row } })

    // Assert
    expect(wrapper.text()).toContain('Privé')
  })

  it('emits toggleDone when the checkbox is pressed', async () => {
    // Arrange
    const row = normalRow()
    const wrapper = mount(ItemRow, { props: { row, showCheckbox: true } })

    // Act
    await wrapper.get('button[aria-pressed]').trigger('click')

    // Assert
    expect(wrapper.emitted('toggleDone')).toHaveLength(1)
  })
})
