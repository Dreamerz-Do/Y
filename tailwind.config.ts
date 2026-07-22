import type { Config } from 'tailwindcss'

// Tokens are defined once as CSS custom properties in src/app/tokens.css
// (light + dark). Tailwind only maps onto them, so a single source of truth
// drives both utility classes and raw CSS. See spec 7.9.
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      bg: 'var(--color-bg)',
      surface: 'var(--color-surface)',
      surface2: 'var(--color-surface-2)',
      border: 'var(--color-border)',
      text: 'var(--color-text)',
      muted: 'var(--color-text-muted)',
      faint: 'var(--color-text-faint)',
      accent: 'var(--color-accent)',
      'accent-text': 'var(--color-accent-text)',
      danger: 'var(--color-danger)',
    },
    borderRadius: {
      none: '0',
      focus: '6px',
      badge: '10px',
      input: '12px',
      card: '14px',
      board: '16px',
      sheet: '24px',
      full: '999px',
    },
    fontFamily: {
      sans: ["'Roboto'", 'system-ui', 'sans-serif'],
    },
    fontSize: {
      meta: ['0.6875rem', { lineHeight: '1rem' }],
      label: ['0.8125rem', { lineHeight: '1.125rem' }],
      body2: ['0.875rem', { lineHeight: '1.25rem' }],
      body: ['0.9375rem', { lineHeight: '1.4rem' }],
      lg: ['1rem', { lineHeight: '1.5rem' }],
      title: ['1.0625rem', { lineHeight: '1.5rem' }],
      screen: ['1.25rem', { lineHeight: '1.75rem' }],
    },
    extend: {
      spacing: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config
