import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BoardsView from './BoardsView.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const create = vi.fn()
vi.mock('../api/boardRepository', () => ({
  boardRepository: {
    list: () => Promise.resolve([]),
    members: () => Promise.resolve([]),
    create: (name: string, hue: number) => create(name, hue),
  },
}))
vi.mock('@/modules/invitations/api/invitationRepository', () => ({
  invitationRepository: { listMine: () => Promise.resolve([]) },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockReset()
  create.mockReset().mockResolvedValue({ id: 'new-board', name: 'Huishouden', accentHue: 215, defaultVisibility: 'board', createdBy: 'u1' })
})

describe('BoardsView', () => {
  it('offers a way to create the first board when the list is empty', async () => {
    // Arrange
    const wrapper = mount(BoardsView)

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('button[aria-label="Nieuw board"]').exists()).toBe(true)
  })

  it('creates a board and navigates into it', async () => {
    // Arrange
    const wrapper = mount(BoardsView)
    await flushPromises()
    await wrapper.get('button[aria-label="Nieuw board"]').trigger('click')
    await wrapper.get('[role="dialog"] input').setValue('Huishouden')

    // Act
    await wrapper.get('[role="dialog"] button[class*="bg-accent"]').trigger('click')
    await flushPromises()

    // Assert
    expect(create).toHaveBeenCalledWith('Huishouden', expect.any(Number))
    expect(push).toHaveBeenCalledWith({ name: 'board', params: { boardId: 'new-board', tab: 'today' } })
  })

  it('reaches the account screen from the header icon', async () => {
    // Arrange
    const wrapper = mount(BoardsView)
    await flushPromises()

    // Act
    await wrapper.get('button[aria-label="Account"]').trigger('click')

    // Assert
    expect(push).toHaveBeenCalledWith({ name: 'account' })
  })

  it('keeps the decorative account icon from swallowing a tap', () => {
    // Arrange — an <svg> that receives pointer events steals the tap on iOS
    // Safari, so the icon must stay out of the way and the button be the target.
    const wrapper = mount(BoardsView)

    // Act
    const icon = wrapper.get('button[aria-label="Account"] svg')

    // Assert
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.classes()).toContain('pointer-events-none')
  })
})
