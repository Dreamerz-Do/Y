import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { mockSupabase, seedSession } from './fixtures'

// A visual walkthrough of every MVP screen. Each test drives the real app with
// a mocked Supabase (see fixtures.ts) and captures a full-page screenshot into
// e2e/__screens__ so the UI can actually be looked at, in CI or locally.

const SHOTS = 'e2e/__screens__'
mkdirSync(SHOTS, { recursive: true })

async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

test.describe('unauthenticated', () => {
  test('login screen', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/login')
    await expect(page.getByRole('button')).toBeVisible()

    // Assert
    await shot(page, '01-login')
  })

  test('sign-up screen', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    // Assert
    await shot(page, '02-signup')
  })
})

test.describe('authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page)
  })

  test('boards overview — empty', async ({ page }) => {
    // Arrange
    await mockSupabase(page, { boards: [] })

    // Act
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Nieuw board' }).first()).toBeVisible()

    // Assert
    await shot(page, '03-boards-empty')
  })

  test('boards overview — with boards', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/')
    await expect(page.getByText('Huishouden')).toBeVisible()

    // Assert
    await shot(page, '04-boards-list')
  })

  test('board create sheet', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/')
    await expect(page.getByText('Huishouden')).toBeVisible()

    // Act
    await page.getByRole('button', { name: 'Nieuw board' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Assert
    await shot(page, '05-board-create')
  })

  test('board — today tab', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/today')
    await expect(page.getByRole('heading', { name: 'Vandaag' })).toBeVisible()

    // Assert
    await shot(page, '06-board-today')
  })

  test('board — agenda tab', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/agenda')
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible()

    // Assert
    await shot(page, '07-board-agenda')
  })

  test('board — to-dos tab', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/todos')
    await expect(page.getByRole('heading', { name: 'Te doen' })).toBeVisible()

    // Assert
    await shot(page, '08-board-todos')
  })

  test('quick capture sheet', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/b/board-1/today')
    await expect(page.getByRole('heading', { name: 'Vandaag' })).toBeVisible()

    // Act
    await page.locator('nav button[aria-label="Nieuw item"]').click()
    await expect(page.getByRole('dialog', { name: 'Nieuw item' })).toBeVisible()

    // Assert
    await shot(page, '09-quick-capture')
  })

  test('full item editor', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/b/board-1/today')
    await page.locator('nav button[aria-label="Nieuw item"]').click()
    await expect(page.getByRole('dialog', { name: 'Nieuw item' })).toBeVisible()

    // Act
    await page.getByRole('button', { name: /Meer opties/ }).click()

    // Assert
    await page.waitForTimeout(200)
    await shot(page, '10-item-editor')
  })

  test('members and groups', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/members')
    await expect(page.getByRole('heading', { name: 'Leden', exact: true })).toBeVisible()

    // Assert
    await shot(page, '11-members')
  })

  test('account screen', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Assert
    await shot(page, '12-account')
  })
})
