# CLAUDE.md

Project instructions for Claude Code. Read this before changing anything.

## Source of truth

The full specification lives in [`docs/spec.md`](docs/spec.md). That document
describes behaviour, permissions and scope. Do not deviate from it — report a
discrepancy instead of quietly resolving it.

Key sections:

| Topic | Section |
|---|---|
| MVP scope | 2 |
| Item visibility | 3.2 |
| Domain model | 4.1 |
| Authorisation matrix | 4.2 |
| Architecture | 6 |
| Design | 7 |
| Build instructions | 9 |

## What this project is

A household organiser: shared boards holding tasks and calendar items, where
visibility is configurable per item. Vue 3 + TypeScript + Vite, Capacitor for
Android, Supabase (Postgres) as the backend. All infrastructure in Western
Europe.

## Commands

```bash
npm install
npm run dev          # dev server
npm run test         # Vitest
npm run test:watch
npm run lint
npm run typecheck
npm run build

npx supabase db push          # apply migrations
npx supabase gen types typescript --local > src/shared/types/database.ts
```

## Hard rules

Non-negotiable. Code that conflicts with these is wrong, even when it works.

1. **Every query is board-scoped.** Authorisation is always (user, board), never
   user alone.
2. **Visibility is enforced in the database**, through RLS policies. Filtering in
   the frontend is not an implementation — it is a bug.
3. **Never put domain content in a notification payload.** A neutral indicator
   only.
4. **No personal data in logs.** Identifiers yes; titles and email addresses no.
5. **No distinction between "not found" and "no access"** in error messages.
6. **Meaning is never carried by colour alone.**
7. **The service key never appears in client code**, nor in a workflow a fork can
   trigger.

## Code conventions

- TypeScript in `strict` mode. No `any`, no `@ts-ignore` without an inline
  justification.
- **Composition API with `<script setup>`. Options API is not permitted.**
- Database types are generated, never hand-written.
- No `supabase` calls in components or stores — only in a module's repository
  layer.
- A store holds either client state or server data for one domain, never both.
- Dutch in the UI, English in code, comments, docs and commits.
- No new dependency without raising it explicitly first.

## Folder structure

```
src/
  modules/
    auth/ boards/ items/ invitations/
      components/ composables/ api/ types/
  shared/
    ui/ composables/ lib/ types/
  router/
  stores/
  app/
docs/
```

Modules talk to each other through explicit exports, never by reaching into each
other's internal files.

## Tests

- **Every file and every piece of functionality is tested** with Vitest.
- The spec file sits next to the file it tests: `itemRepository.ts` →
  `itemRepository.spec.ts`.
- **Every test follows Arrange, Act, Assert**, in that order and visibly
  separated. One action per test; if a second Act is needed, it is a second test.
- RLS policies are tested separately against the database, per role and per
  action from the authorisation matrix. A policy without a test counts as absent.

## Working method per task

1. Migration first: schema change and RLS policy in the same migration file.
2. Regenerate types.
3. Repository layer, then composable, then component.
4. Tests alongside the change, not afterwards.
5. Small, complete units. Five small changes beat one large one.

## Branches and releases

- `feature/*` branches from `develop`, PR back into `develop`
- `develop` deploys to the development environment
- `main` deploys to production, only via PR from `develop` after QA and review
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Migrations always run on development first. A migration already applied to
  production is never edited; corrections happen in a new migration.

## Definition of done

- Meets the hard rules and the code conventions
- Migrations and policies are in the repo and tested
- The relevant rows of the authorisation matrix are covered by tests
- Accessibility checked: contrast, focus, touch target, screen reader label
- Both the web build and the Android build run
- No personal data in logs or error messages

## Not without discussion

- Changing the stack or adding dependencies
- Relaxing or bypassing an RLS policy, including temporarily for debugging
- Extending the data model
- Adding features outside the MVP list
- Copying production data into development
