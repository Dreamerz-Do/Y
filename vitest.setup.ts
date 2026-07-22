// Global test setup. Kept minimal; per-file arrange steps do the rest.
import { beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  // A fresh Pinia per test keeps stores isolated (Arrange).
  setActivePinia(createPinia())
})
