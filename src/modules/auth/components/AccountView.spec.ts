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
    const spy = vi.spyOn(session, 'deleteAccount').mockResolvedValue()
    const wrapper = mount(AccountView)

    // Act
    await wrapper.get('button.border-danger').trigger('click')

    // Assert
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('permanent verwijderd')
    await dialog.get('button.bg-danger').trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('surfaces an actionable message when deletion is refused', async () => {
    // Arrange
    const session = useSessionStore()
    session.user = { id: 'u1', email: 'a@b.nl' }
    vi.spyOn(session, 'deleteAccount').mockRejectedValue(new Error('sole owner'))
    const wrapper = mount(AccountView)

    // Act
    await wrapper.get('button.border-danger').trigger('click')
    await wrapper.get('[role="alertdialog"] button.bg-danger').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.get('[role="alert"]').text()).toContain('enige eigenaar')
  })
})
