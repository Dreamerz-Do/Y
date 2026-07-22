import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PendingInvitations from './PendingInvitations.vue'

const listMine = vi.fn()
const accept = vi.fn()
const decline = vi.fn()

vi.mock('../api/invitationRepository', () => ({
  invitationRepository: {
    listMine: () => listMine(),
    accept: (id: string) => accept(id),
    decline: (id: string) => decline(id),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  listMine.mockReset().mockResolvedValue([])
  accept.mockReset().mockResolvedValue(undefined)
  decline.mockReset().mockResolvedValue(undefined)
})

describe('PendingInvitations', () => {
  it('renders nothing when there are no invitations', async () => {
    // Arrange
    const wrapper = mount(PendingInvitations)

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('emits accepted after an invitation is accepted', async () => {
    // Arrange
    listMine.mockResolvedValueOnce([{ id: 'inv1', boardId: 'b1', boardName: 'Huishouden', role: 'member' }])
    const wrapper = mount(PendingInvitations)
    await flushPromises()

    // Act
    await wrapper.get('button.bg-accent').trigger('click')
    await flushPromises()

    // Assert
    expect(accept).toHaveBeenCalledWith('inv1')
    expect(wrapper.emitted('accepted')).toHaveLength(1)
  })
})
