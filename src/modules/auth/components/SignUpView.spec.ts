import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SignUpView from './SignUpView.vue'
import { useSessionStore } from '@/stores/session'

const replace = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))

function mountView() {
  return mount(SignUpView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  replace.mockReset()
})

async function fillAndSubmit(wrapper: ReturnType<typeof mountView>) {
  await wrapper.get('input[type="text"]').setValue('Jeffrey')
  await wrapper.get('input[type="email"]').setValue('a@b.nl')
  await wrapper.get('input[type="password"]').setValue('password12')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('SignUpView', () => {
  it('routes to the boards overview when sign-up starts a session', async () => {
    // Arrange
    const wrapper = mountView()
    vi.spyOn(useSessionStore(), 'signUp').mockResolvedValue(true)

    // Act
    await fillAndSubmit(wrapper)

    // Assert
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('shows a confirm-your-email notice when no session starts', async () => {
    // Arrange
    const wrapper = mountView()
    vi.spyOn(useSessionStore(), 'signUp').mockResolvedValue(false)

    // Act
    await fillAndSubmit(wrapper)

    // Assert
    expect(wrapper.get('[role="status"]').text()).toContain('Bevestig je e-mailadres')
    expect(replace).not.toHaveBeenCalled()
  })
})
