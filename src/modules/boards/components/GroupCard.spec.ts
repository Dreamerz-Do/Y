import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupCard from './GroupCard.vue'
import type { Group, Member } from '../types/board'

const members: Member[] = [
  { membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 200 },
  { membershipId: 'm2', userId: 'u2', name: 'Laura', role: 'member', hue: 320 },
]

function makeGroup(overrides: Partial<Group> = {}): Group {
  return { id: 'g1', boardId: 'b1', name: 'Ouders', memberIds: ['m1'], ...overrides }
}

describe('GroupCard', () => {
  it('adds a member to the group when an unchecked box is toggled', async () => {
    // Arrange
    const wrapper = mount(GroupCard, { props: { group: makeGroup(), members } })

    // Act
    await wrapper.get('input[aria-label="Laura"]').setValue(true)

    // Assert
    expect(wrapper.emitted('setMembers')?.[0]?.[0]).toEqual(['m1', 'm2'])
  })

  it('removes a member from the group when a checked box is toggled', async () => {
    // Arrange
    const wrapper = mount(GroupCard, { props: { group: makeGroup(), members } })

    // Act
    await wrapper.get('input[aria-label="Jeffrey"]').setValue(false)

    // Assert
    expect(wrapper.emitted('setMembers')?.[0]?.[0]).toEqual([])
  })

  it('offers to save only once the name has actually changed', async () => {
    // Arrange
    const wrapper = mount(GroupCard, { props: { group: makeGroup(), members } })
    expect(wrapper.find('button.bg-accent').exists()).toBe(false)

    // Act
    await wrapper.get('input[aria-label="Naam van groep Ouders"]').setValue('Volwassenen')

    // Assert
    await wrapper.get('button.bg-accent').trigger('click')
    expect(wrapper.emitted('rename')?.[0]?.[0]).toBe('Volwassenen')
  })
})
