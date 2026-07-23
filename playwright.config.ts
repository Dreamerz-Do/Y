import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Offline e2e / visual walkthrough. The dev server boots against mock env
// (passed below) and all Supabase traffic is intercepted in the tests, so this
// runs with no backend — deterministically, in CI or the sandbox.
//
// Browser selection: in the sandbox a Chromium is pre-installed at a fixed path
// whose revision need not match @playwright/test, so we point at it directly. In
// CI there is no such path — `npx playwright install chromium` provides the
// managed browser and Playwright resolves it itself (leave executablePath unset).
const PINNED_CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const executablePath = existsSync(PINNED_CHROMIUM) ? PINNED_CHROMIUM : undefined

// Mock Supabase env so the app boots. Any non-empty values work — every request
// is intercepted, nothing real is hit. The storage key supabase-js derives from
// this URL is `sb-mock-auth-token`, which fixtures.ts seeds.
const MOCK_ENV = {
  VITE_SUPABASE_URL: 'https://mock.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'mock-anon-key-for-e2e',
  VITE_APP_ENV: 'development',
}

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.output',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 430, height: 900 },
    launchOptions: { executablePath },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, ...MOCK_ENV } as Record<string, string>,
  },
})
