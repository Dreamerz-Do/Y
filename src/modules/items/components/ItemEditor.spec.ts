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

  it('limits the assignee list to the viewer when they cannot assign others', () => {
    // Arrange — a guest (canAssignOthers false) may assign only to themselves.
    const form = { ...emptyForm(), title: 'Eigen klus' }

    // Act
    const wrapper = mount(ItemEditor, {
      props: { mode: 'create', initialForm: form, members, groups, canAssignOthers: false, myMembershipId: 'm1' },
    })

    // Assert — only "Niemand" + Jeffrey (self); Laura is not offered.
    const options = wrapper.get('select[aria-label="Toegewezen aan"]').findAll('option')
    expect(options.map((o) => o.text())).toEqual(['Niemand', 'Jeffrey'])
  })

  it('is read-only when the viewer may not edit the item', () => {
    // Arrange
    const form = { ...emptyForm(), title: 'Van iemand anders' }

    // Act
    const wrapper = mount(ItemEditor, {
      props: { mode: 'edit', initialForm: form, members, groups, canEdit: false },
    })

    // Assert — form disabled, no save/delete, an explicit read-only notice.
    expect((wrapper.get('fieldset').element as HTMLFieldSetElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Alleen-lezen')
    expect(wrapper.find('button[class*="bg-accent"]').exists()).toBe(false)
    expect(wrapper.find('button.text-danger').exists()).toBe(false)
  })
})
