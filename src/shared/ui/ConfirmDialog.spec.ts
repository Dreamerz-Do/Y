import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from './ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('names what disappears in the message', () => {
    // Arrange
    const message = 'Alle items van Laura worden permanent verwijderd.'

    // Act
    const wrapper = mount(ConfirmDialog, { props: { title: 'Laura verwijderen?', message } })

    // Assert
    expect(wrapper.get('[role="alertdialog"]').text()).toContain(message)
  })

  it('emits confirm when the confirm button is pressed', async () => {
    // Arrange
    const wrapper = mount(ConfirmDialog, {
      props: { title: 'X', message: 'Y', confirmLabel: 'Verwijderen', danger: true },
    })

    // Act
    await wrapper.get('button.bg-danger').trigger('click')

    // Assert
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
