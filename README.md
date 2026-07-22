# Gezinsorganisatie-app

Gedeelde boards met taken en agenda-items voor volwassenen die samen een druk
huishouden runnen. Per item is instelbaar wie het mag zien.

> **Status:** in ontwikkeling. De MVP is nog niet af.

## Waarom

Coördinatie in een druk gezin zit verspreid over hoofden, appjes en losse
agenda's. Deze app brengt het samen in één gedeeld overzicht, met twee
uitgangspunten die de bestaande alternatieven niet hebben:

- **Offloaden in plaats van registreren.** Wat in je hoofd zit staat binnen
  seconden in de app, en wat terugkeert hoeft niemand te bewaken.
- **Privacy binnen het gezin.** Een gedeeld board betekent niet dat alles
  gedeeld is. Zichtbaarheid is per item instelbaar, en de agenda blijft
  bruikbaar doordat privé-afspraken als inhoudsloos "bezet"-blok verschijnen.

Wat de app expliciet **niet** doet: taakverdeling meten, scores bijhouden of
oordelen over wie meer doet.

## Tech stack

| Laag | Keuze |
|---|---|
| Frontend | Vite, Vue 3, TypeScript, Pinia, Composition API |
| Styling | Tailwind met headless componenten |
| Mobiel | Capacitor (Android) |
| Backend | Supabase (Postgres, Auth, RLS) |
| Hosting | Firebase Hosting |
| Testen | Vitest, plus RLS-policytests tegen de database |
| Regio | West-Europa, voor alle infrastructuur |

## Documentatie

| Document | Inhoud |
|---|---|
| [`docs/gezinsapp-spec.md`](docs/gezinsapp-spec.md) | Volledige specificatie: scope, features, domeinmodel, architectuur, design |
| [`CLAUDE.md`](CLAUDE.md) | Projectinstructies voor Claude Code |

De specificatie is de bron van waarheid voor gedrag en rechten. Wijkt de code
ervan af, dan is dat een bug of een bewuste wijziging die eerst in het document
landt.

## Aan de slag

Vereist: Node 22 of hoger, npm, en de Supabase CLI.

```bash
npm install
cp .env.example .env.local   # vul de waarden in
npm run dev
```

Benodigde omgevingsvariabelen:

| Variabele | Toelichting |
|---|---|
| `VITE_SUPABASE_URL` | URL van het Supabase-project |
| `VITE_SUPABASE_ANON_KEY` | Publieke anon key |
| `VITE_APP_ENV` | `development` of `production` |

De **service key hoort hier niet bij** en komt nooit in clientcode of in de repo.

## Scripts

```bash
npm run dev          # dev server
npm run test         # Vitest
npm run test:watch
npm run lint
npm run typecheck
npm run build
```

## Projectstructuur

```
src/
  modules/            # domeingericht: auth, boards, items, invitations
    <module>/
      components/
      composables/
      api/            # enige plek met supabase-aanroepen
      types/
  shared/             # ui, composables, lib, types
  router/
  stores/             # alleen cross-cutting state
  app/
supabase/
  migrations/         # schema en RLS-policies, onder versiebeheer
docs/
```

Testbestanden staan naast de code die ze testen: `itemRepository.ts` naast
`itemRepository.spec.ts`.

## Branches en omgevingen

| Branch | Doel | Omgeving |
|---|---|---|
| `feature/*` | Losse wijziging, kortlevend | — |
| `develop` | Integratie en feature-testing | Development |
| `main` | Productie | Productie |

Feature branch vertakt van `develop` en gaat via PR terug. Na QA op de
development-omgeving volgt een PR van `develop` naar `main` met code review.

Commits volgen [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

Migraties draaien altijd eerst op development. Een migratie die op productie is
toegepast wordt nooit bewerkt — corrigeren gebeurt met een nieuwe migratie.

## Privacy

Leidend principe: **data die niet voor een gebruiker bedoeld is, mag die
gebruiker nooit bereiken.** Niet in een API-respons, niet in een realtime-event,
niet in een pushbericht, niet in een cache, niet in een logregel.

Zichtbaarheid wordt afgedwongen in de database via RLS-policies, niet in de
frontend. Productiedata wordt nooit gekopieerd naar development.

## Toegankelijkheid

Doel is WCAG 2.2 niveau AA, met EN 301 549 als kader. Zie sectie 7.8 van de
specificatie voor de concrete eisen.
