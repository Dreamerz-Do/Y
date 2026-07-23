import type { Page, Route } from '@playwright/test'

// Offline Supabase test double for the Playwright walkthrough.
//
// The app must never reach a real backend from CI or the sandbox (the egress
// proxy blocks the Supabase host, and e2e must be deterministic anyway). So we
// seed a fake auth session into localStorage — enough for the router's auth
// guard and for supabase-js to attach a bearer token — and intercept every
// Supabase REST/Auth/RPC call, answering from the fixtures below.
//
// This is a *view* harness: it exercises the real screens and their data flow,
// not the RLS policies. Authorisation is verified separately by the pgTAP suite
// (supabase/tests), which is the only correct place to test it (hard rule 2).

// The storage key supabase-js derives from VITE_SUPABASE_URL=https://mock.supabase.co
// is `sb-<first-label>-auth-token` → `sb-mock-auth-token`.
const STORAGE_KEY = 'sb-mock-auth-token'

export const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'jeffrey@example.com',
  display_name: 'Jeffrey',
}

export const BOARDS = [
  {
    id: 'board-1',
    name: 'Huishouden',
    accent_hue: 215,
    default_visibility: 'board',
    created_by: USER.id,
    created_at: '2026-05-01T09:00:00Z',
  },
  {
    id: 'board-2',
    name: 'Vakantie 2026',
    accent_hue: 145,
    default_visibility: 'board',
    created_by: USER.id,
    created_at: '2026-06-12T09:00:00Z',
  },
]

const MEMBERSHIP_ME = 'mem-1'

export const MEMBERSHIPS = [
  {
    id: MEMBERSHIP_ME,
    user_id: USER.id,
    board_id: 'board-1',
    role: 'owner',
    profiles: { display_name: 'Jeffrey', color_hue: 215 },
  },
  {
    id: 'mem-2',
    user_id: '22222222-2222-2222-2222-222222222222',
    board_id: 'board-1',
    role: 'member',
    profiles: { display_name: 'Sanne', color_hue: 320 },
  },
  {
    id: 'mem-3',
    user_id: '33333333-3333-3333-3333-333333333333',
    board_id: 'board-1',
    role: 'guest',
    profiles: { display_name: 'Oma', color_hue: 45 },
  },
]

export const GROUPS = [{ id: 'grp-1', board_id: 'board-1', name: 'Ouders' }]

// Two dated items land "today" so the Today tab is never empty, whichever day
// the suite runs. The rest are spread across the week and the to-do list.
const today = new Date().toISOString().slice(0, 10)

export const ITEMS = [
  {
    id: 'item-1',
    board_id: 'board-1',
    title: 'Tandarts Sanne',
    notes: null,
    assignee_id: 'mem-2',
    starts_at: `${today}T09:30:00Z`,
    ends_at: `${today}T10:00:00Z`,
    all_day: false,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: 'blue',
    created_by: USER.id,
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-07-01T09:00:00Z',
  },
  {
    id: 'item-2',
    board_id: 'board-1',
    title: 'Boodschappen doen',
    notes: 'Melk, brood, eieren',
    assignee_id: MEMBERSHIP_ME,
    starts_at: `${today}T17:00:00Z`,
    ends_at: null,
    all_day: false,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: 'green',
    created_by: USER.id,
    created_at: '2026-07-02T09:00:00Z',
    updated_at: '2026-07-02T09:00:00Z',
  },
  {
    id: 'item-3',
    board_id: 'board-1',
    title: 'Verjaardag Oma',
    notes: null,
    assignee_id: null,
    starts_at: '2026-08-14T00:00:00Z',
    ends_at: null,
    all_day: true,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: 'purple',
    created_by: USER.id,
    created_at: '2026-07-03T09:00:00Z',
    updated_at: '2026-07-03T09:00:00Z',
  },
  {
    id: 'item-4',
    board_id: 'board-1',
    title: 'Lekkende kraan repareren',
    notes: null,
    assignee_id: MEMBERSHIP_ME,
    starts_at: null,
    ends_at: null,
    all_day: false,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: null,
    created_by: USER.id,
    created_at: '2026-07-04T09:00:00Z',
    updated_at: '2026-07-04T09:00:00Z',
  },
  {
    id: 'item-5',
    board_id: 'board-1',
    title: 'Vuilnis buiten zetten',
    notes: null,
    assignee_id: null,
    starts_at: null,
    ends_at: null,
    all_day: false,
    is_done: true,
    visibility: 'board',
    reveal_owner: true,
    color: null,
    created_by: USER.id,
    created_at: '2026-07-05T09:00:00Z',
    updated_at: '2026-07-05T09:00:00Z',
  },
]

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

/** Seed a non-expired fake session so the auth guard treats us as signed in. */
export async function seedSession(page: Page): Promise<void> {
  const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  const session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: farFuture,
    user: {
      id: USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: USER.email,
      app_metadata: { provider: 'email' },
      user_metadata: { display_name: USER.display_name },
      created_at: '2026-01-01T00:00:00Z',
    },
  }
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  )
}

/**
 * Intercept every Supabase call and answer from the fixtures. Matching is by
 * the table/rpc/auth path, mirroring what the repositories request.
 */
export async function mockSupabase(
  page: Page,
  overrides: { boards?: unknown[]; items?: unknown[] } = {},
): Promise<void> {
  const boards = overrides.boards ?? BOARDS
  const items = overrides.items ?? ITEMS

  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url()
    if (url.includes('/user')) {
      return json(route, {
        id: USER.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: USER.email,
        app_metadata: { provider: 'email' },
        user_metadata: { display_name: USER.display_name },
      })
    }
    // logout, token refresh, etc.
    return json(route, {})
  })

  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '')
    const table = path.split('?')[0]

    switch (table) {
      case 'boards':
        return json(route, boards)
      case 'memberships':
        return json(route, MEMBERSHIPS)
      case 'groups':
        return json(route, GROUPS)
      case 'group_members':
        return json(route, [])
      case 'items':
        return json(route, items)
      case 'calendar_busy_blocks':
        return json(route, [])
      case 'item_shares':
        return json(route, [])
      case 'my_pending_invitations':
        return json(route, [])
      case 'invitations':
        return json(route, [])
      default:
        // rpc/<fn> and anything unmapped: answer benignly.
        if (path.startsWith('rpc/create_board')) return json(route, boards[0] ?? BOARDS[0])
        return json(route, [])
    }
  })
}
