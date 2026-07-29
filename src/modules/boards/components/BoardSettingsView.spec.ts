import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import BoardSettingsView from './BoardSettingsView.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const setHue = vi.fn()
vi.mock('@/shared/composables/useBoardAccent', () => ({ useBoardAccent: () => ({ setHue }) }))

vi.mock('@/stores/session', () => ({ useSessionStore: () => ({ user: { id: 'u1' } }) }))

const board = { id: 'b1', name: 'Huishouden', accentHue: 215, defaultVisibility: 'board', createdBy: 'u1' }
const updateBoard = vi.fn().mockResolvedValue(undefined)
const deleteBoard = vi.fn().mockResolvedValue(undefined)
let membersList: Array<{ membershipId: string; userId: string; name: string; role: string; hue: number }> = []

vi.mock('../composables/boardStore', () => ({
  useBoardStore: () => ({
    boardById: () => board,
    membersOf: () => membersList,
    boards: [board],
    loadBoards: vi.fn().mockResolvedValue(undefined),
    loadMembers: vi.fn().mockResolvedValue(undefined),
    updateBoard,
    deleteBoard,
  }),
}))

function byText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('button').find((b) => b.text().trim() === text)!
}

beforeEach(() => {
  push.mockReset()
  updateBoard.mockClear()
  deleteBoard.mockClear()
  membersList = [{ membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 215 }]
})

describe('BoardSettingsView (owner)', () => {
  it('saves an edited name and returns to the board', async () => {
    // Arrange
    const wrapper = mount(BoardSettingsView, { props: { boardId: 'b1' } })
    await flushPromises()
    await wrapper.get('input[aria-label="Naam van het board"]').setValue('Nieuw')

    // Act
    await byText(wrapper, 'Opslaan').trigger('click')
    await flushPromises()

    // Assert
    expect(updateBoard).toHaveBeenCalledWith('b1', {
      name: 'Nieuw',
      accentHue: 215,
      defaultVisibility: 'board',
    })
    expect(push).toHaveBeenCalledWith({ name: 'board', params: { boardId: 'b1', tab: 'kalender' } })
  })

  it('deletes the board after confirmation and goes to the overview', async () => {
    // Arrange
    const wrapper = mount(BoardSettingsView, { props: { boardId: 'b1' } })
    await flushPromises()
    await byText(wrapper, 'Board verwijderen').trigger('click')

    // Act
    await byText(wrapper, 'Definitief verwijderen').trigger('click')
    await flushPromises()

    // Assert
    expect(deleteBoard).toHaveBeenCalledWith('b1')
    expect(push).toHaveBeenCalledWith({ name: 'boards' })
  })
})

describe('BoardSettingsView (non-owner)', () => {
  it('shows the settings read-only', async () => {
    // Arrange
    membersList = [{ membershipId: 'm2', userId: 'u1', name: 'Mees', role: 'member', hue: 10 }]

    // Act
    const wrapper = mount(BoardSettingsView, { props: { boardId: 'b1' } })
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Alleen eigenaren kunnen de instellingen wijzigen')
    expect(wrapper.find('input[aria-label="Naam van het board"]').exists()).toBe(false)
  })
})
