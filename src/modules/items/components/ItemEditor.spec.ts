import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemEditor from './ItemEditor.vue'
import { emptyForm, type ItemForm } from '../composables/itemForm'
import type { Group, Member } from '@/modules/boards/types/board'

const members: Member[] = [
  { membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 200 },
  { membershipId: 'm2', userId: 'u2', name: 'Laura', role: 'owner', hue: 320 },
]
const groups: Group[] = [{ id: 'g1', boardId: 'b1', name: 'Ouders', memberIds: ['m1', 'm2'] }]

function mountEditor(mode: 'create' | 'edit', form: ItemForm) {
  return mount(ItemEditor, { props: { mode, initialForm: form, members, groups } })
}

describe('ItemEditor', () => {
  it('disables saving until the item has a title', () => {
    // Arrange
    const form = { ...emptyForm(), title: '' }

    // Act
    const wrapper = mountEditor('create', form)

    // Assert
    const save = wrapper.get('button[class*="bg-accent"]')
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits the form on save', async () => {
    // Arrange
    const form = { ...emptyForm(), title: 'Boodschappen' }
    const wrapper = mountEditor('create', form)

    // Act
    await wrapper.get('button[class*="bg-accent"]').trigger('click')

    // Assert
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ title: 'Boodschappen' })
  })

  it('shows the audience picker only for a shared_with item', async () => {
    // Arrange
    const form = { ...emptyForm(), title: 'Cadeau', visibility: 'shared_with' as const }

    // Act
    const wrapper = mountEditor('create', form)

    // Assert
    expect(wrapper.text()).toContain('Delen met')
    expect(wrapper.text()).toContain('Ouders')
  })

  it('offers a delete action in edit mode', async () => {
    // Arrange
    const form = { ...emptyForm(), title: 'Bestaand' }
    const wrapper = mountEditor('edit', form)

    // Act
    await wrapper.get('button.text-danger').trigger('click')

    // Assert
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})
