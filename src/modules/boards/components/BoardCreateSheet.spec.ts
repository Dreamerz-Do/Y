import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BoardCreateSheet from './BoardCreateSheet.vue'
import { BOARD_ACCENT_HUES } from '@/shared/lib/palette'

describe('BoardCreateSheet', () => {
  it('disables creating until a name is entered', () => {
    // Arrange
    const wrapper = mount(BoardCreateSheet)

    // Act
    const save = wrapper.get('button[class*="bg-accent"]')

    // Assert
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits create with the name and the default accent hue', async () => {
    // Arrange
    const wrapper = mount(BoardCreateSheet)
    await wrapper.get('input').setValue('Huishouden')

    // Act
    await wrapper.get('button[class*="bg-accent"]').trigger('click')

    // Assert
    expect(wrapper.emitted('create')?.[0]).toEqual(['Huishouden', BOARD_ACCENT_HUES[0]])
  })

  it('emits the chosen accent hue when a swatch is picked', async () => {
    // Arrange
    const wrapper = mount(BoardCreateSheet)
    await wrapper.get('input').setValue('Werk')

    // Act
    await wrapper.get('button[aria-label="Accentkleur 2"]').trigger('click')
    await wrapper.get('button[class*="bg-accent"]').trigger('click')

    // Assert
    expect(wrapper.emitted('create')?.[0]).toEqual(['Werk', BOARD_ACCENT_HUES[1]])
  })

  it('trims whitespace from the name', async () => {
    // Arrange
    const wrapper = mount(BoardCreateSheet)
    await wrapper.get('input').setValue('  Thuis  ')

    // Act
    await wrapper.get('button[class*="bg-accent"]').trigger('click')

    // Assert
    expect(wrapper.emitted('create')?.[0]?.[0]).toBe('Thuis')
  })
})
