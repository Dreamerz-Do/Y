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
  {
    // A board where the seeded user is the only member, so it can be deleted.
    id: 'board-solo',
    name: 'Alleen ik',
    accent_hue: 25,
    default_visibility: 'board',
    created_by: USER.id,
    created_at: '2026-06-20T09:00:00Z',
  },
  {
    // A board where the seeded user is a guest (for the read-only editor).
    id: 'board-guest',
    name: 'Buren',
    accent_hue: 320,
    default_visibility: 'board',
    created_by: '22222222-2222-2222-2222-222222222222',
    created_at: '2026-06-25T09:00:00Z',
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
  {
    id: 'mem-solo',
    user_id: USER.id,
    board_id: 'board-solo',
    role: 'owner',
    profiles: { display_name: 'Jeffrey', color_hue: 215 },
  },
  {
    id: 'mem-guest-owner',
    user_id: '22222222-2222-2222-2222-222222222222',
    board_id: 'board-guest',
    role: 'owner',
    profiles: { display_name: 'Sanne', color_hue: 320 },
  },
  {
    id: 'mem-guest-me',
    user_id: USER.id,
    board_id: 'board-guest',
    role: 'guest',
    profiles: { display_name: 'Jeffrey', color_hue: 215 },
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
  {
    // On the guest board, created by the owner — the seeded guest can't edit it.
    id: 'item-guest',
    board_id: 'board-guest',
    title: 'Sleutel teruggeven',
    notes: null,
    assignee_id: null,
    starts_at: null,
    ends_at: null,
    all_day: false,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: null,
    created_by: '22222222-2222-2222-2222-222222222222',
    created_at: '2026-07-06T09:00:00Z',
    updated_at: '2026-07-06T09:00:00Z',
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

/** Parse a request's JSON body, tolerating an empty one. */
function reqBody(route: Route): Record<string, unknown> {
  try {
    return (route.request().postDataJSON() as Record<string, unknown>) ?? {}
  } catch {
    return {}
  }
}

function userObject() {
  return {
    id: USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: USER.email,
    app_metadata: { provider: 'email' },
    user_metadata: { display_name: USER.display_name },
    created_at: '2026-01-01T00:00:00Z',
  }
}

function sessionObject() {
  const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: farFuture,
    user: userObject(),
  }
}

/** Seed a non-expired fake session so the auth guard treats us as signed in. */
export async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(sessionObject())] as const,
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
    if (url.includes('/user')) return json(route, userObject())
    // token (password / refresh grant): return a full session.
    if (url.includes('/token')) return json(route, sessionObject())
    // logout and anything else.
    return json(route, {})
  })

  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '')
    const table = path.split('?')[0]
    const method = route.request().method()

    // RPCs are POSTed to rest/v1/rpc/<fn> and return a single row.
    if (table.startsWith('rpc/')) {
      const fn = table.slice('rpc/'.length)
      if (fn === 'create_board') {
        const body = reqBody(route)
        return json(route, {
          ...BOARDS[0],
          id: 'e2e-board',
          name: (body.board_name as string) ?? 'Nieuw board',
          accent_hue: (body.accent as number) ?? 215,
        })
      }
      if (fn === 'create_invitation') {
        const body = reqBody(route)
        return json(route, {
          id: 'e2e-inv',
          board_id: (body.b as string) ?? 'board-1',
          email: (body.target_email as string) ?? 'x@example.com',
          role: (body.target_role as string) ?? 'member',
          status: 'pending',
          invited_by: USER.id,
          created_at: '2026-07-23T00:00:00Z',
        })
      }
      return json(route, null)
    }

    switch (table) {
      case 'boards':
        // A settings edit uses .update().select().single(); a delete has no body.
        if (method === 'PATCH') return json(route, { ...BOARDS[0], ...reqBody(route) })
        if (method === 'DELETE') return json(route, [])
        return json(route, boards)
      case 'memberships': {
        // The query filters by board_id=eq.<id>; honour it so a solo board reads
        // as a single member.
        const filter = url.searchParams.get('board_id')?.replace(/^eq\./, '')
        const rows = filter ? MEMBERSHIPS.filter((m) => m.board_id === filter) : MEMBERSHIPS
        return json(route, rows)
      }
      case 'groups':
        return json(route, GROUPS)
      case 'group_members':
        return json(route, [])
      case 'items': {
        // A write (insert/update) uses .select().single(): echo one full row.
        if (method === 'POST' || method === 'PATCH') {
          return json(route, { ...ITEMS[0], id: 'e2e-item', ...reqBody(route) })
        }
        const board = url.searchParams.get('board_id')?.replace(/^eq\./, '')
        return json(route, board ? items.filter((i) => (i as { board_id: string }).board_id === board) : items)
      }
      case 'calendar_busy_blocks':
        return json(route, [])
      case 'item_shares':
        return json(route, [])
      case 'my_pending_invitations':
        return json(route, [])
      case 'invitations':
        return json(route, [])
      default:
        return json(route, [])
    }
  })
}
