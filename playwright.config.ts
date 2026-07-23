import { defineConfig } from '@playwright/test'

// Offline e2e / visual walkthrough. The dev server boots against mock env
// (.env.local) and all Supabase traffic is intercepted in the tests, so this
// runs with no backend — deterministically, in CI or the sandbox.
//
// The browser binary is the one pre-installed in the environment; its revision
// need not match the @playwright/test version, so we point at it explicitly
// instead of running `playwright install`.
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.output',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 430, height: 900 },
    launchOptions: { executablePath: CHROMIUM },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
