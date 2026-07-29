import { test, expect, type Request } from '@playwright/test'
import { mockSupabase, seedSession } from './fixtures'

// Behavioural e2e: drive the UI and assert the exact Supabase call each action
// fires. Where the screenshot suite proves a screen *renders*, this proves the
// screen is *wired* — the button reaches the repository with the right payload.
// Authorisation itself stays with the pgTAP suite (CLAUDE.md hard rule 2).

/** The request a table/rpc receives, matched by path + method. */
function expectRequest(page: import('@playwright/test').Page, match: string, method = 'POST') {
  return page.waitForRequest(
    (r: Request) => r.url().includes(match) && r.method() === method,
  )
}

test.describe('interactions', () => {
  test('sign in posts credentials and lands on the boards overview', async ({ page }) => {
    // Arrange — no seeded session: we start signed out on /login.
    await mockSupabase(page)
    await page.goto('/login')
    await page.locator('input[type=email]').fill('jeffrey@example.com')
    await page.locator('input[type=password]').fill('correct horse')

    // Act
    const [tokenReq] = await Promise.all([
      expectRequest(page, '/auth/v1/token'),
      page.getByRole('button', { name: 'Inloggen' }).click(),
    ])

    // Assert
    expect(tokenReq.postDataJSON()).toMatchObject({ email: 'jeffrey@example.com' })
    await expect(page.getByRole('heading', { name: 'Boards', exact: true })).toBeVisible()
  })

  test('creating a board calls create_board and navigates into it', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nieuw board' }).first().click()
    await page.getByRole('dialog').getByRole('textbox').fill('Vakantie 2027')

    // Act
    const [rpcReq] = await Promise.all([
      expectRequest(page, '/rest/v1/rpc/create_board'),
      page.getByRole('button', { name: 'Board aanmaken' }).click(),
    ])

    // Assert
    expect(rpcReq.postDataJSON()).toMatchObject({ board_name: 'Vakantie 2027' })
    await expect(page).toHaveURL(/\/b\/e2e-board\//)
  })

  test('quick capture inserts an item with the typed title', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/b/board-1/kalender')
    await page.locator('nav button[aria-label="Nieuw item"]').click()
    await page.getByRole('dialog', { name: 'Nieuw item' }).getByRole('textbox').fill('Kaarten kopen')

    // Act
    const [insertReq] = await Promise.all([
      expectRequest(page, '/rest/v1/items'),
      page.getByRole('button', { name: 'Opslaan' }).click(),
    ])

    // Assert
    expect(insertReq.postDataJSON()).toMatchObject({ title: 'Kaarten kopen', board_id: 'board-1' })
  })

  test('ticking a to-do patches is_done', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/b/board-1/todos')
    const checkbox = page.getByRole('button', { name: /Lekkende kraan repareren, markeer als gedaan/ })
    await expect(checkbox).toBeVisible()

    // Act
    const [patchReq] = await Promise.all([
      expectRequest(page, '/rest/v1/items', 'PATCH'),
      checkbox.click(),
    ])

    // Assert
    expect(patchReq.postDataJSON()).toMatchObject({ is_done: true })
  })

  test('inviting a member calls create_invitation with the email', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/b/board-1/members')
    await page.getByLabel('E-mailadres om uit te nodigen').fill('nieuw@example.com')

    // Act
    const [rpcReq] = await Promise.all([
      expectRequest(page, '/rest/v1/rpc/create_invitation'),
      page.getByRole('button', { name: 'Uitnodigen' }).click(),
    ])

    // Assert
    expect(rpcReq.postDataJSON()).toMatchObject({ target_email: 'nieuw@example.com' })
  })

  test('renaming a board patches it and returns to the board', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/b/board-1/settings')
    await page.getByRole('heading', { name: 'Bordinstellingen' }).waitFor()
    await page.getByLabel('Naam van het board').fill('Ons Huishouden')

    // Act
    const [patchReq] = await Promise.all([
      expectRequest(page, '/rest/v1/boards', 'PATCH'),
      page.getByRole('button', { name: 'Opslaan' }).click(),
    ])

    // Assert
    expect(patchReq.postDataJSON()).toMatchObject({ name: 'Ons Huishouden' })
    await expect(page).toHaveURL(/\/b\/board-1\/kalender$/)
  })

  test('deleting a sole-member board calls delete_board and returns to the overview', async ({ page }) => {
    // Arrange — board-solo has only the seeded user, so delete is allowed.
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/b/board-solo/settings')
    await page.getByRole('button', { name: 'Board verwijderen' }).click()

    // Act
    const [rpcReq] = await Promise.all([
      expectRequest(page, '/rest/v1/rpc/delete_board'),
      page.getByRole('button', { name: 'Definitief verwijderen' }).click(),
    ])

    // Assert
    expect(rpcReq.postDataJSON()).toMatchObject({ b: 'board-solo' })
    await expect(page).toHaveURL(/\/$/)
  })

  test('the account icon reaches the logout screen by touch', async ({ page }) => {
    // Arrange
    await seedSession(page)
    await mockSupabase(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Boards', exact: true })).toBeVisible()

    // Act — a tap, not a click: the reported failure was touch-only.
    await page.tap('button[aria-label="Account"]')

    // Assert
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible()
  })
})
