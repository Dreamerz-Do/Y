import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InviteForm from './InviteForm.vue'

// Mock the repository the store calls, so the component exercises the real
// store against a fake Supabase.
const create = vi.fn()
vi.mock('../api/invitationRepository', () => ({
  invitationRepository: {
    create: (b: string, e: string, r: string) => create(b, e, r),
    listForBoard: () => Promise.resolve([]),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  create.mockReset().mockResolvedValue(undefined)
})

describe('InviteForm', () => {
  it('invites the entered address and confirms on success', async () => {
    // Arrange
    const wrapper = mount(InviteForm, { props: { boardId: 'b1' } })
    await wrapper.get('input[type="email"]').setValue('laura@example.com')

    // Act
    await wrapper.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))

    // Assert
    expect(create).toHaveBeenCalledWith('b1', 'laura@example.com', 'member')
    expect(wrapper.get('[role="status"]').text()).toContain('verstuurd')
  })

  it('shows a message and no address when the invite fails', async () => {
    // Arrange
    create.mockRejectedValueOnce(new Error('no account'))
    const wrapper = mount(InviteForm, { props: { boardId: 'b1' } })
    await wrapper.get('input[type="email"]').setValue('ghost@example.com')

    // Act
    await wrapper.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))

    // Assert
    expect(wrapper.get('[role="alert"]').text()).toContain('Uitnodigen mislukt')
    expect(wrapper.text()).not.toContain('ghost@example.com')
  })
})
