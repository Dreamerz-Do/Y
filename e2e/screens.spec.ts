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

  test('board — kalender tab (month calendar)', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/kalender')
    await expect(page.getByRole('button', { name: 'Volgende maand' })).toBeVisible()

    // Assert
    await shot(page, '06-board-kalender')
  })

  test('board — day sheet from a calendar day', async ({ page }) => {
    // Arrange — the two seeded items land today, so today's cell has items.
    await mockSupabase(page)
    await page.goto('/b/board-1/kalender')
    await expect(page.getByRole('button', { name: 'Volgende maand' })).toBeVisible()

    // Act
    await page.getByRole('button', { name: /items/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Assert
    await shot(page, '07-board-day-sheet')
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

  test('board — lijst tab (all items, newest first)', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/lijst')
    await expect(page.getByRole('heading', { name: 'Alle items' })).toBeVisible()

    // Assert
    await shot(page, '09-board-lijst')
  })

  test('quick capture sheet', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/b/board-1/kalender')
    await expect(page.getByRole('button', { name: 'Volgende maand' })).toBeVisible()

    // Act
    await page.locator('nav button[aria-label="Nieuw item"]').click()
    await expect(page.getByRole('dialog', { name: 'Nieuw item' })).toBeVisible()

    // Assert
    await shot(page, '10-quick-capture')
  })

  test('quick capture — details expanded inline', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/b/board-1/kalender')
    await page.locator('nav button[aria-label="Nieuw item"]').click()
    await expect(page.getByRole('dialog', { name: 'Nieuw item' })).toBeVisible()

    // Act
    await page.getByRole('button', { name: '+ Details toevoegen' }).click()
    await expect(page.getByText('Zichtbaar voor')).toBeVisible()

    // Assert
    await shot(page, '11-capture-details')
  })

  test('full item editor (existing item)', async ({ page }) => {
    // Arrange
    await mockSupabase(page)
    await page.goto('/b/board-1/lijst')
    await expect(page.getByText('Tandarts Sanne')).toBeVisible()

    // Act
    await page.getByText('Tandarts Sanne').click()
    await expect(page.getByRole('dialog', { name: 'Item bewerken' })).toBeVisible()

    // Assert
    await shot(page, '12-item-editor')
  })

  test('board settings (owner)', async ({ page }) => {
    // Arrange — the seeded user is owner of board-1, so the form is editable.
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/settings')
    await expect(page.getByRole('heading', { name: 'Bordinstellingen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Board verwijderen' })).toBeVisible()

    // Assert
    await shot(page, '13-board-settings')
  })

  test('read-only editor for a guest on another member\'s item', async ({ page }) => {
    // Arrange — the seeded user is a guest on board-guest; the item is the
    // owner's, so it opens read-only.
    await mockSupabase(page)
    await page.goto('/b/board-guest/lijst')
    await expect(page.getByText('Sleutel teruggeven')).toBeVisible()

    // Act
    await page.getByText('Sleutel teruggeven').click()
    await expect(page.getByRole('dialog', { name: 'Item bekijken' })).toBeVisible()

    // Assert
    await expect(page.getByText('Alleen-lezen')).toBeVisible()
    await shot(page, '14-item-readonly-guest')
  })

  test('members and groups', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/b/board-1/members')
    await expect(page.getByRole('heading', { name: 'Leden', exact: true })).toBeVisible()

    // Assert
    await shot(page, '15-members')
  })

  test('account screen', async ({ page }) => {
    // Arrange
    await mockSupabase(page)

    // Act
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Assert
    await shot(page, '15-account')
  })
})
