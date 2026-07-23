import { describe, it, expect } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ItemCaptureSheet from './ItemCaptureSheet.vue'
import { todayInZone } from '../composables/itemDateTime'
import type { Member, Group } from '@/modules/boards/types/board'

const members: Member[] = [
  { membershipId: 'm1', userId: 'u1', name: 'Jeffrey', role: 'owner', hue: 215 },
]
const groups: Group[] = [{ id: 'g1', boardId: 'b1', name: 'Ouders', memberIds: ['m1'] }]

function mountSheet() {
  return mount(ItemCaptureSheet, { props: { members, groups, defaultVisibility: 'board' } })
}

function byText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('button').find((b) => b.text().trim() === text)!
}

describe('ItemCaptureSheet', () => {
  it('keeps the details hidden until they are asked for', () => {
    // Arrange
    const wrapper = mountSheet()

    // Act
    const detailsButton = wrapper.find('button[aria-pressed]')

    // Assert
    expect(wrapper.text()).toContain('Details toevoegen')
    expect(detailsButton.exists()).toBe(false)
  })

  it('reveals the detail fields inline when details are added', async () => {
    // Arrange
    const wrapper = mountSheet()

    // Act
    await byText(wrapper, '+ Details toevoegen').trigger('click')

    // Assert
    expect(wrapper.text()).toContain('Datum')
    expect(wrapper.text()).toContain('Zichtbaar voor')
    expect(wrapper.text()).not.toContain('Details toevoegen')
  })

  it('disables saving until a title is present', async () => {
    // Arrange
    const wrapper = mountSheet()

    // Act
    await wrapper.get('input[aria-label="Titel van het item"]').setValue('Kaarten kopen')

    // Assert
    expect((byText(wrapper, 'Opslaan').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('emits the captured form with the typed title', async () => {
    // Arrange
    const wrapper = mountSheet()
    await wrapper.get('input[aria-label="Titel van het item"]').setValue('Kaarten kopen')

    // Act
    await byText(wrapper, 'Opslaan').trigger('click')

    // Assert
    const saved = wrapper.emitted('save')?.[0]?.[0] as { title: string; hasDate: boolean }
    expect(saved.title).toBe('Kaarten kopen')
    expect(saved.hasDate).toBe(false)
  })

  it('captures an all-day date when "Vandaag" is chosen', async () => {
    // Arrange
    const wrapper = mountSheet()
    await wrapper.get('input[aria-label="Titel van het item"]').setValue('Verjaardag')
    await byText(wrapper, '+ Details toevoegen').trigger('click')

    // Act
    await byText(wrapper, 'Vandaag').trigger('click')
    await byText(wrapper, 'Opslaan').trigger('click')

    // Assert
    const saved = wrapper.emitted('save')?.[0]?.[0] as { hasDate: boolean; allDay: boolean; date: string }
    expect(saved).toMatchObject({ hasDate: true, allDay: true, date: todayInZone() })
  })
})
