# End-to-end walkthrough

A Playwright suite that drives the real app without a backend, in two parts:

- **`screens.spec.ts`** — screenshots every MVP screen into `e2e/__screens__/`,
  so the UI can actually be looked at (in CI those land as the `e2e-screens`
  build artifact).
- **`interactions.spec.ts`** — asserts the exact Supabase call each action
  fires: sign-in posts credentials, creating a board calls `create_board`, quick
  capture inserts an item, ticking a to-do patches `is_done`, inviting a member
  calls `create_invitation`. Where the screenshots prove a screen *renders*, this
  proves it is *wired*.

## Why it's offline

The egress proxy blocks the Supabase host, and e2e must be deterministic anyway.
So the harness:

- seeds a fake, non-expired session into `localStorage` (`fixtures.ts` →
  `seedSession`), enough for the router's auth guard and for supabase-js to
  attach a bearer token; and
- intercepts every Supabase REST / Auth / RPC call and answers from fixtures
  (`fixtures.ts` → `mockSupabase`).

This is a **view** harness: it exercises the screens and their data flow, not the
RLS policies. Authorisation is verified separately by the pgTAP suite in
`supabase/tests` — the only correct place to test it (CLAUDE.md hard rule 2).

## Run it

```bash
npm run test:e2e
```

The dev server boots against the mock env in `.env.local` (copy the three
`VITE_*` values from `.env.example`; any non-empty value works — nothing real is
hit). Screenshots land in `e2e/__screens__/` (git-ignored).

The browser binary is the one already installed in the environment; its revision
need not match `@playwright/test`. Override the path with
`PLAYWRIGHT_CHROMIUM_PATH` if it lives elsewhere. In CI there is no such path, so
`npx playwright install chromium` provides the managed browser and the config
resolves it automatically (see the `e2e` job in `.github/workflows/ci.yml`).
