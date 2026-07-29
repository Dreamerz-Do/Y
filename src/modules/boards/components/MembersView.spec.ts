import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MembersView from './MembersView.vue'
import { useSessionStore } from '@/stores/session'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const members = vi.fn()
const removeMember = vi.fn()
const leave = vi.fn()
vi.mock('../api/boardRepository', () => ({
  boardRepository: {
    list: () => Promise.resolve([{ id: 'b1', name: 'Huishouden', accentHue: 1, defaultVisibility: 'board', createdBy: 'u1' }]),
    members: (id: string) => members(id),
    updateRole: () => Promise.resolve(),
    removeMember: (mid: string) => removeMember(mid),
    leave: (id: string, receiver?: string) => leave(id, receiver),
  },
}))
vi.mock('../api/groupRepository', () => ({
  groupRepository: { listByBoard: () => Promise.resolve([]) },
}))
vi.mock('@/modules/invitations/api/invitationRepository', () => ({
  invitationRepository: { listForBoard: () => Promise.resolve([]) },
}))

const OWNER = { membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 200 }
const OWNER2 = { membershipId: 'm3', userId: 'u3', name: 'Sanne', role: 'owner', hue: 40 }
const MEMBER = { membershipId: 'm2', userId: 'u2', name: 'Laura', role: 'member', hue: 320 }

function mountAsUser(userId: string) {
  const session = useSessionStore()
  session.user = { id: userId, email: 'x@y.nl' }
  return mount(MembersView, { props: { boardId: 'b1' } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  members.mockReset().mockResolvedValue([OWNER, MEMBER])
  removeMember.mockReset().mockResolvedValue(undefined)
  leave.mockReset().mockResolvedValue(undefined)
})

describe('MembersView', () => {
  it('shows role controls to an owner', async () => {
    // Arrange
    const wrapper = mountAsUser('u1')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('select[aria-label="Rol van Laura"]').exists()).toBe(true)
  })

  it('hides role controls from a non-owner', async () => {
    // Arrange
    const wrapper = mountAsUser('u2')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('select[aria-label="Rol van Jeffrey"]').exists()).toBe(false)
  })

  it('confirms — naming what disappears — before removing a member', async () => {
    // Arrange
    const wrapper = mountAsUser('u1')
    await flushPromises()

    // Act
    await wrapper.get('button[aria-label="Laura verwijderen"]').trigger('click')

    // Assert
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('privé-items van Laura worden verwijderd')
    await dialog.get('button.bg-danger').trigger('click')
    await flushPromises()
    expect(removeMember).toHaveBeenCalledWith('m2')
  })

  it('lets a member leave, deleting only their private items', async () => {
    // Arrange
    const wrapper = mountAsUser('u2')
    await flushPromises()

    // Act
    await wrapper.findAll('button').find((b) => b.text() === 'Board verlaten')!.trigger('click')
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('privé-items worden verwijderd')
    await dialog.get('button.bg-danger').trigger('click')
    await flushPromises()

    // Assert — no receiver: a member does not hand over items.
    expect(leave).toHaveBeenCalledWith('b1', undefined)
  })

  it('hands items to a chosen owner when an owner leaves', async () => {
    // Arrange — a second owner exists to receive the items.
    members.mockResolvedValue([OWNER, OWNER2, MEMBER])
    const wrapper = mountAsUser('u1')
    await flushPromises()

    // Act
    await wrapper.findAll('button').find((b) => b.text() === 'Board verlaten')!.trigger('click')
    const dialog = wrapper.get('[role="dialog"][aria-label="Board verlaten"]')
    await dialog.get('button').trigger('click')
    await flushPromises()

    // Assert — receiver defaults to the other owner (m3).
    expect(leave).toHaveBeenCalledWith('b1', 'm3')
  })

  it('blocks a sole owner from leaving until another owner exists', async () => {
    // Arrange — u1 is the only owner, with a plain member present.
    const wrapper = mountAsUser('u1')
    await flushPromises()

    // Act
    await wrapper.findAll('button').find((b) => b.text() === 'Board verlaten')!.trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('enige eigenaar')
    expect(leave).not.toHaveBeenCalled()
  })
})
