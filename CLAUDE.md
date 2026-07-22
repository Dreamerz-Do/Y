# CLAUDE.md

Projectinstructies voor Claude Code. Lees dit voordat je iets wijzigt.

## Bron van waarheid

De volledige specificatie staat in [`docs/gezinsapp-spec.md`](docs/gezinsapp-spec.md).
Dat document beschrijft gedrag, rechten en scope. Wijk er niet van af — meld een
discrepantie in plaats van hem stilzwijgend op te lossen.

Belangrijkste secties:

| Onderwerp | Sectie |
|---|---|
| MVP-scope | 2 |
| Zichtbaarheid van items | 3.2 |
| Domeinmodel | 4.1 |
| Autorisatiematrix | 4.2 |
| Architectuur | 6 |
| Design | 7 |
| Bouwinstructies | 9 |

## Wat dit project is

Een gezinsorganisatie-app: gedeelde boards met taken en agenda-items, waarbij per
item instelbaar is wie het mag zien. Vue 3 + TypeScript + Vite, Capacitor voor
Android, Supabase (Postgres) als backend. Alle infrastructuur in West-Europa.

## Commando's

```bash
npm install
npm run dev          # dev server
npm run test         # Vitest
npm run test:watch
npm run lint
npm run typecheck
npm run build

npx supabase db push          # migraties toepassen
npx supabase gen types typescript --local > src/shared/types/database.ts
```

## Harde regels

Deze zijn niet onderhandelbaar. Code die hiermee botst is fout, ook als hij werkt.

1. **Elke query is board-scoped.** Autorisatie is altijd (user, board), nooit alleen user.
2. **Zichtbaarheid wordt in de database afgedwongen**, via RLS-policies. Filteren in
   de frontend is geen implementatie maar een bug.
3. **Nooit domeininhoud in een notificatiepayload.** Alleen een neutrale aanduiding.
4. **Geen persoonsgegevens in logs.** Identifiers wel, titels en e-mailadressen niet.
5. **Geen onderscheid tussen "bestaat niet" en "geen toegang"** in foutmeldingen.
6. **Betekenis nooit uitsluitend via kleur.**
7. **De service key komt nooit in clientcode of in een workflow die door een fork
   getriggerd kan worden.**

## Codeconventies

- TypeScript in `strict`-modus. Geen `any`, geen `@ts-ignore` zonder toelichting.
- **Composition API met `<script setup>`. Options API is niet toegestaan.**
- Databasetypes worden gegenereerd, nooit handmatig geschreven.
- Geen `supabase`-aanroepen in componenten of stores — alleen in de repository-laag
  van een module.
- Eén store bevat óf clientstate óf serverdata van één domein.
- Nederlands in de UI, Engels in code en commits.
- Geen nieuwe dependency zonder dat expliciet voor te leggen.

## Mappenstructuur

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

Modules praten met elkaar via expliciete exports, niet dwars door elkaars interne
bestanden.

## Tests

- **Elk bestand en elke functionaliteit wordt getest** met Vitest.
- Specfile staat naast het bestand: `itemRepository.ts` → `itemRepository.spec.ts`.
- **Elke test volgt Arrange, Act, Assert**, in die volgorde en zichtbaar gescheiden.
  Eén handeling per test; is er een tweede Act nodig, dan is het een tweede test.
- RLS-policies worden apart getest tegen de database, per rol en per actie uit de
  autorisatiematrix. Een policy zonder test geldt als niet aanwezig.

## Werkwijze per taak

1. Migratie eerst: schemawijziging en RLS-policy in hetzelfde migratiebestand.
2. Types opnieuw genereren.
3. Repository-laag, dan composable, dan component.
4. Tests bij de wijziging, niet erna.
5. Kleine, afgeronde eenheden. Liever vijf kleine wijzigingen dan één grote.

## Branches en releases

- `feature/*` vertakt van `develop`, PR terug naar `develop`
- `develop` deployt naar de development-omgeving
- `main` deployt naar productie, alleen via PR vanaf `develop` na QA en review
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Migraties draaien altijd eerst op development. Een migratie die op productie is
  toegepast wordt nooit bewerkt; corrigeren gebeurt met een nieuwe migratie.

## Definition of done

- Voldoet aan de harde regels en de codeconventies
- Migraties en policies staan in de repo en zijn getest
- De relevante rijen uit de autorisatiematrix zijn afgedekt met tests
- Toegankelijkheid gecontroleerd: contrast, focus, aanraakvlak, schermlezerlabel
- Zowel de webbuild als de Android-build draait
- Geen persoonsgegevens in logs of foutmeldingen

## Niet zonder overleg

- Wijzigen van de stack of toevoegen van dependencies
- Versoepelen of omzeilen van een RLS-policy, ook tijdelijk om te debuggen
- Uitbreiden van het datamodel
- Toevoegen van features buiten de MVP-lijst
- Productiedata kopiëren naar development
