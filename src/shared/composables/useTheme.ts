import { ref, watchEffect } from 'vue'

/**
 * Light/dark theme, designed in from the start (spec 7.3). Three states:
 * 'system' follows the OS, 'light' and 'dark' pin it. The choice is stamped as
 * data-theme on <html>, which the token CSS keys off. Persisted in
 * localStorage so it survives a reload.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'ho.theme'
const choice = ref<ThemeChoice>(readInitial())

function readInitial(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function apply(value: ThemeChoice): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (value === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', value)
  }
}

let started = false

export function useTheme() {
  if (!started) {
    started = true
    watchEffect(() => {
      apply(choice.value)
      if (typeof localStorage !== 'undefined') {
        if (choice.value === 'system') localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, choice.value)
      }
    })
  }

  function toggle(): void {
    // A plain toggle cycles the two explicit states; 'system' resolves first.
    const resolved = resolveEffective()
    choice.value = resolved === 'dark' ? 'light' : 'dark'
  }

  function resolveEffective(): 'light' | 'dark' {
    if (choice.value !== 'system') return choice.value
    if (typeof window === 'undefined' || !window.matchMedia) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return { choice, toggle, resolveEffective }
}
