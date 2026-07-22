# Household Organiser

Shared boards holding tasks and calendar items, for adults running a busy
household together. Visibility is configurable per item.

> **Status:** in development. The MVP is not finished.

## Why

Coordination in a busy household is scattered across people's heads, chat
threads and separate calendars. This app brings it into one shared view, on two
principles the existing alternatives do not offer:

- **Offloading rather than recording.** Whatever is in your head is in the app
  within seconds, and anything recurring no longer needs anyone to watch it.
- **Privacy inside the household.** A shared board does not mean everything is
  shared. Visibility is set per item, and the calendar stays usable because
  private appointments appear as a contentless "busy" block.

What the app deliberately does **not** do: measure how work is divided, keep
scores, or pass judgement on who does more.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vite, Vue 3, TypeScript, Pinia, Composition API |
| Styling | Tailwind with headless components |
| Mobile | Capacitor (Android) |
| Backend | Supabase (Postgres, Auth, RLS) |
| Hosting | Firebase Hosting |
| Testing | Vitest, plus RLS policy tests against the database |
| Region | Western Europe, for all infrastructure |

## Documentation

| Document | Contents |
|---|---|
| [`docs/spec.md`](docs/spec.md) | Full specification: scope, features, domain model, architecture, design |
| [`CLAUDE.md`](CLAUDE.md) | Project instructions for Claude Code |

The specification is the source of truth for behaviour and permissions. Where
the code diverges from it, that is either a bug or a deliberate change that
lands in the document first.

## Getting started

Requires Node 22 or higher, npm, and the Supabase CLI.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Required environment variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL of the Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_APP_ENV` | `development` or `production` |

The **service key is not among these** and never belongs in client code or in
the repository.

## Scripts

```bash
npm run dev          # dev server
npm run test         # Vitest
npm run test:watch
npm run lint
npm run typecheck
npm run build
```

## Project structure

```
src/
  modules/            # domain-oriented: auth, boards, items, invitations
    <module>/
      components/
      composables/
      api/            # the only place with supabase calls
      types/
  shared/             # ui, composables, lib, types
  router/
  stores/             # cross-cutting state only
  app/
supabase/
  migrations/         # schema and RLS policies, under version control
docs/
```

Test files sit next to the code they cover: `itemRepository.ts` alongside
`itemRepository.spec.ts`.

## Branches and environments

| Branch | Purpose | Environment |
|---|---|---|
| `feature/*` | A single change, short-lived | — |
| `develop` | Integration and feature testing | Development |
| `main` | Production | Production |

A feature branch forks from `develop` and returns via PR. After QA on the
development environment, a PR goes from `develop` into `main` with code review.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

Migrations always run on development first. A migration already applied to
production is never edited — corrections happen in a new migration.

## Privacy

Guiding principle: **data not intended for a user must never reach that user.**
Not in an API response, not in a realtime event, not in a push message, not in a
cache, not in a log line.

Visibility is enforced in the database through RLS policies, not in the
frontend. Production data is never copied into development.

## Accessibility

Target is WCAG 2.2 level AA, with EN 301 549 as the framework. See section 7.8
of the specification for the concrete requirements.
