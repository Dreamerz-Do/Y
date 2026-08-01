import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountView from './AccountView.vue'
import { useSessionStore } from '@/stores/session'

const replace = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }))

beforeEach(() => {
  setActivePinia(createPinia())
  replace.mockReset()
})

describe('AccountView', () => {
  it('confirms — naming what disappears — before deleting the account', async () => {
    // Arrange
    const session = useSessionStore()
    session.user = { id: 'u1', email: 'a@b.nl' }
    vi.spyOn(session, 'boardsAwaitingHandover').mockResolvedValue([])
    const spy = vi.spyOn(session, 'deleteAccount').mockResolvedValue()
    const wrapper = mount(AccountView)

    // Act
    await wrapper.get('button.border-danger').trigger('click')
    await flushPromises()

    // Assert
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('permanent verwijderd')
    await dialog.get('button.bg-danger').trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith({})
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('asks for a successor per solely-owned board, then hands it over on delete', async () => {
    // Arrange
    const session = useSessionStore()
    session.user = { id: 'u1', email: 'a@b.nl' }
    vi.spyOn(session, 'boardsAwaitingHandover').mockResolvedValue([
      {
        boardId: 'board-1',
        boardName: 'Huishouden',
        candidates: [{ membershipId: 'mem-2', name: 'Sanne' }],
      },
    ])
    const spy = vi.spyOn(session, 'deleteAccount').mockResolvedValue()
    const wrapper = mount(AccountView)

    // Act
    await wrapper.get('button.border-danger').trigger('click')
    await flushPromises()
    // The successor picker appears; the sole candidate is pre-selected.
    const picker = wrapper.get('[role="dialog"]')
    expect(picker.text()).toContain('Eigenaarschap overdragen')
    await picker.get('button').trigger('click')
    await wrapper.get('[role="alertdialog"] button.bg-danger').trigger('click')
    await flushPromises()

    // Assert
    expect(spy).toHaveBeenCalledWith({ 'board-1': 'mem-2' })
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('surfaces a neutral message when the lookup fails', async () => {
    // Arrange
    const session = useSessionStore()
    session.user = { id: 'u1', email: 'a@b.nl' }
    vi.spyOn(session, 'boardsAwaitingHandover').mockRejectedValue(new Error('boom'))
    const wrapper = mount(AccountView)

    // Act
    await wrapper.get('button.border-danger').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.get('[role="alert"]').text()).toContain('iets mis')
  })
})
