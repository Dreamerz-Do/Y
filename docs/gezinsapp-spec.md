# Gezinsapp — Specificatie

> Levend document. Status per sectie: ✅ vastgelegd · 🟡 in bewerking · ⬜ nog te doen
> Doel: dit document dient later als context/instructie voor het daadwerkelijk bouwen.

---

## 1. Product ✅

**Probleem**
In een druk gezin zit de coördinatie — wie doet wat, wie brengt wie, wat staat er deze week aan — verspreid over hoofden, appjes en losse agenda's. Dat kost mentale ruimte en leidt tot een scheve lastenverdeling en irritatie.

**Doelgroep**
- Primair: de volwassenen die samen een huishouden runnen
- Secundair: overige leden van een board, die zien wat voor hen relevant is

**Kernbelofte**
Eén gedeeld overzicht dat de onzichtbare last zichtbaar en eerlijk verdeeld maakt.

**Kernwaarde**
Intuïtieve UX die een gezin helpt hun leven op orde te brengen én te houden, zodat de samenwerking en de liefde in het gezin behouden blijven.

**Differentiator**
Bestaande apps (Cozi, FamilyWall, Skylight) zijn takenlijsten met een gezinssausje. Deze app onderscheidt zich op twee punten:
1. **Offloaden in plaats van registreren** — alles wat in je hoofd zit staat binnen seconden in de app, en wat terugkeert hoeft niemand meer te bewaken.
2. **Privacy binnen het gezin serieus nemen** — een gedeeld board betekent niet dat alles gedeeld is. Zichtbaarheid per item, met een agenda die bruikbaar blijft.

Expliciet géén differentiator: het meten van verdeling of eerlijkheid. Zie 3.6.

**Succescriterium**
Het gezin gebruikt de app zonder dat iemand hoeft te herinneren dat 'ie bestaat.

**Context**
- Gebouwd voor eigen gezin, in eerste instantie niet commercieel
- Kwaliteitslat productiewaardig: mag niet onderdoen voor commerciële alternatieven
- Distributie via de Play Store is een reële optie voor later. Dat stuurt een aantal keuzes nu al (zie 8).
- Het domein kent bewust géén familie-semantiek. Een board is een gedeelde omgeving, geen gezin. Rechten volgen uit rollen, niet uit relaties.

---

## 2. Scope 🟡

### MVP ✅
Het fundament is autorisatie en structuur — niet de featurebreedte. Concreet:

1. **Account** — registreren en inloggen
2. **Boards aanmaken** — een gebruiker maakt een of meerdere boards aan
3. **Boards-overzicht** — schakelen tussen boards
4. **Leden uitnodigen** — op e-mailadres, door een owner, binnen een board
5. **Items aanmaken** — binnen een board, met zichtbaarheid, met of zonder datum, met optionele kleur uit een vast palet
6. **Data-synchronisatie** — fetchen op de logische lifecycle-momenten, plus een sync-knop als extra (zie 3.5)

Rationale: zodra het rechten- en boardfundament staat, is elke volgende feature een toevoeging in plaats van een verbouwing.

### Later / expliciet buiten scope
- Realtime board-updates (zie 3.3)
- Push- en lokale notificaties (zie 3.5)
- Lijsten (boodschappen e.d.) als apart entiteitstype
- Terugkerende items (zie 3.6.2)
- Externe agenda-koppeling

### Expliciet niet
- Verdelingsoverzichten, eerlijkheidsscores, punten, streaks of ranglijsten (zie 3.6)
- Local-first / offline-editing (zie 5)

---

## 3. Features 🟡

### 3.1 Items: taken en agenda in één model ✅

Er is geen apart "taak"- en "agenda"-type. Eén entiteit `Item`, waarvan de datum het gedrag bepaalt:

- **Item mét datum/tijd** → verschijnt in de agenda
- **Item zónder datum** → staat in de to-do-lijst, af te vinken wanneer het uitkomt

Voordelen: één datamodel, één formulier, en een to-do kan zonder conversie een geplande afspraak worden door er een datum aan te hangen.

Aandachtspunt om later te bewaken: niet alles wat in een agenda staat is "af te vinken" (een verjaardag is niet klaar). Als dat in de UI gaat wringen, is een lichte `type`-hint op `Item` de goedkoopste uitweg — geen tweede entiteit.

⬜ User stories + acceptatiecriteria

### 3.2 Zichtbaarheid per item ✅

Niet alles in een gedeeld board hoeft voor iedereen zichtbaar te zijn.

- Elk item heeft een `visibility`:
  - `board` — zichtbaar voor alle leden met leesrecht op board-brede items (default)
  - `private` — alleen voor de eigenaar
  - `shared-with` — expliciete subset van leden en/of groepen
- **Afdwingen op de datalaag, niet in de UI.** De client ontvangt items die de gebruiker niet mag zien simpelweg niet.

**Bezet-blok** ✅
Een privé-item dat tijd claimt in de agenda verschijnt als een blok zonder inhoud.

- **Tijdsprecisie:** exacte tijd (bijv. 14:00–15:30). De agenda blijft daarmee bruikbaar om op te plannen.
- **Eigenaar:** instelbaar per item — de maker bepaalt of zijn naam bij het blok staat.
- **Inhoud:** nooit zichtbaar. Titel, notities, locatie en deelnemers worden niet uitgeleverd aan de client.
- **Default:** eigenaar wél tonen. Dat is het bruikbare geval; anonimiseren is de bewuste uitzondering.
- Let op: in een board van twee volwassenen verraadt een anoniem blok alsnog vrijwel altijd wie het is. Anonimiteit is hier zachte privacy, geen harde garantie — beloof dat niet te stellig in de UI.

### 3.3 Realtime board-updates ✅ (buiten MVP)

Voegt een lid een item toe, dan verschijnt het direct bij ieder ander lid dat hetzelfde board open heeft staan — zonder verversen.

- Bewust **buiten de MVP**, maar de stackkeuze houdt er rekening mee: Supabase Realtime luistert op Postgres-wijzigingen en respecteert RLS, dus dezelfde policies gelden voor de stream.
- **Aandachtspunt:** het bezet-blok is een afgeleide projectie, geen rij in de database. Een naïeve realtime-stream zou bij een privé-item de volledige rij kunnen uitsturen. Twee veilige routes:
  1. Realtime alleen als *signaal* gebruiken ("er is iets gewijzigd") en de client laten herophalen via de normale, geprojecteerde query.
  2. Een aparte view/kanaal publiceren dat alleen de geprojecteerde velden bevat.
  Route 1 is simpeler en minder foutgevoelig; route 2 is zuiniger. Beslissing pas nodig bij implementatie.
- ⬜ Presence ("wie kijkt er mee") is expliciet géén onderdeel hiervan.
- Zie 6.4 voor de hersynchronisatieregels. Die zijn geen implementatiedetail: zonder die regels toont de app na een verbroken verbinding stil verouderde data, inclusief items waarvoor de toegang inmiddels is ingetrokken.

### 3.5 Notificaties en synchronisatie 🟡

#### MVP: fetchen op lifecycle-momenten ✅
Data wordt opgehaald op de logische momenten in de levenscyclus van de app. Dat is het basisgedrag, geen feature:

- bij inloggen en bij het openen van een board
- bij navigeren naar een scherm dat de data nodig heeft
- bij app-resume en bij herstel van de netwerkverbinding
- na elke mutatie

**Daarnaast** een sync-knop, als expliciete escape voor de gebruiker die iets verwacht en niet wil wachten. Extra, niet in plaats van het bovenstaande.

Realtime (3.3) komt hier later bovenop en vervangt het niet — de hersynchronisatieregels in 6.4 blijven ook dan gelden.

#### Later: lokale notificaties
Herinneringen voor items met een datum zijn **lokale** notificaties (`@capacitor/local-notifications`). Geen server, geen tokenregistratie, geen FCM. Dekt waarschijnlijk het grootste deel van de waarde.

#### Later: push (FCM)
Alleen nodig voor gebeurtenissen die van een ander lid komen: een item aan jou toegewezen, een uitnodiging.

- Op Android is FCM de transportlaag, geen keuze. Diensten als OneSignal versturen zelf ook via FCM en voegen alleen een vendor toe.
- Distributie zonder Play Store is geen belemmering: FCM vereist Google Play Services op het toestel, niet distributie via de store.
- Route: database webhook op een `notifications`-tabel → Supabase Edge Function → FCM HTTP v1.
- Webversie heeft hiervoor geen Firebase nodig: standaard Web Push met VAPID volstaat.

#### Harde regel: nooit domeininhoud in een pushbericht ✅
Een Edge Function draait met de service key en **omzeilt RLS volledig**. Zet je een itemtitel in de notificatietekst, dan belandt de inhoud van een privé-item op het lockscreen van een ander — en onderweg bij Google. Het zichtbaarheidsmodel lekt dan via het enige kanaal dat er niet doorheen loopt.

- Payload bevat uitsluitend een neutrale aanduiding ("Nieuw item in Thuis") of is data-only.
- De app haalt de inhoud altijd op via de normale, RLS-gefilterde query.
- Geldt ook voor lokale notificaties op een gedeeld toestel.

### 3.6 Mental load verlagen (niet meten) ✅

**Uitgangspunt: de app verlaagt de last, ze meet hem niet.**
Geen verdelingsoverzicht, geen percentages, geen ranglijst, geen eerlijkheidsscore. Reden: zo'n dashboard wordt in de praktijk munitie in een ruzie en beschadigt precies datgene wat de app moet beschermen. De winst zit in *offloaden*, niet in *aantonen*.

#### 3.6.1 Snelle capture
De helft van de mentale last bestaat uit dingen die nergens staan ("schoenen worden te klein"). Als het niet binnen enkele seconden in de app staat, blijft het in iemands hoofd.

- Eén invoerveld. Enige verplichte veld is de titel.
- Datum, toewijzing en zichtbaarheid zijn optioneel en achteraf in te vullen.
- Zichtbaarheid valt terug op het standaardpubliek van het board.
- Bereikbaar vanaf elk scherm.
- Later te overwegen: Android share-target, homescreen-widget, spraakinvoer.

#### 3.6.2 Terugkerende items (buiten MVP)
Zodra de app iets onthoudt, hoeft niemand het meer te bewaken. Dit verlaagt de last direct in plaats van hem in beeld te brengen.

- `recurrence` op `Item`.
- ⬜ Instances vooraf genereren of virtueel afleiden?
- ⬜ Wat gebeurt er bij overslaan?
- ⬜ Eén instantie aanpassen versus de hele reeks?

#### 3.6.3 Erkenning
Een lichtgewicht bevestiging op een afgerond item — "gezien, bedankt".

- **Expliciet geen** punten, streaks, badges of totalen. Zodra waardering optelbaar wordt, is het een score en zijn we terug bij het scorebord.
- Altijd optioneel. De afwezigheid ervan mag nooit als signaal worden gepresenteerd — dus geen herinneringen in de trant van "je hebt nog niet bedankt".
- ⬜ Wel of geen notificatie bij erkenning?

---

## 4. Business logic & domeinmodel 🟡

### 4.1 Entiteiten

| Entiteit | Beschrijving |
|---|---|
| `User` | Een app-account. Bestaat losstaand van boards. |
| `Board` | Een gedeelde omgeving. Een user kan er meerdere hebben. |
| `Membership` | Koppeling tussen `User` en `Board`. Draagt de rol. |
| `Group` | Benoemde verzameling memberships binnen één board. Publiek, geen rechtenniveau. |
| `Item` | Taak of agenda-item binnen een board. Draagt `visibility` + `revealOwner`. |
| `Invitation` | Openstaande uitnodiging voor een bestaande gebruiker. |

**Velden van `Item` (indicatief)**
`title`, `notes`, `assigneeId`, `startsAt?`, `endsAt?`, `allDay`, `isDone`, `visibility`, `sharedWith[]`, `revealOwner`, `createdBy`

`color?` — optionele itemkleur uit een klein vast palet (zie 7.3). Onderdeel van de MVP. Geen betekenis op applicatieniveau; puur persoonlijke markering. Nooit de enige drager van betekenis (zie 7.8).

### 4.2 Rollen en autorisatie ✅

Drie rollen: `owner`, `member`, `guest`.

- **De rol hangt aan de `Membership`, niet aan de `User`** — iemand kan owner zijn van board A en member van board B. Elke check is dus altijd (user, board).
- Geen relatie-semantiek. Of iemand kind, ouder of buurvrouw is, doet niet ter zake voor rechten. Dat is bewust: relaties zijn glibberig, rollen zijn toetsbaar.
- Een board kan meerdere owners hebben en moet er altijd minimaal één houden.

**Autorisatiematrix**

| Actie | `owner` | `member` | `guest` |
|---|:--:|:--:|:--:|
| Board-instellingen wijzigen | ✅ | ❌ | ❌ |
| Board verwijderen | ✅ | ❌ | ❌ |
| Leden uitnodigen / verwijderen | ✅ | ❌ | ❌ |
| Rollen wijzigen | ✅ | ❌ | ❌ |
| Groepen beheren | ✅ | ❌ | ❌ |
| Board-brede items zien | ✅ | ✅ | ❌ |
| Items zien die met hem gedeeld zijn | ✅ | ✅ | ✅ |
| Items aanmaken | ✅ | ✅ | ✅ |
| Eigen items bewerken / verwijderen | ✅ | ✅ | ✅ |
| Items van anderen bewerken | ✅ | ✅ | ❌ |
| Item toewijzen aan een ander lid | ✅ | ✅ | ❌ |

**Rol `guest`**
Ziet alleen wat expliciet met hem gedeeld of aan hem toegewezen is. Dat vangt "niet iedereen hoeft alles te zien" af op rolniveau in plaats van per item — zonder één woord over familierelaties. Bruikbaar voor een jonger kind, een oppas of een grootouder die alleen bij de ophaaldiensten betrokken is.

Deze matrix is tevens de testspec: elke rij is een test, per rol.

### 4.3 Groepen ✅

Groepen zijn **publiek, geen rechtenniveau**. Ze bestaan om zichtbaarheid snel instelbaar te maken, niet om een tweede autorisatie-as te introduceren.

- Een `Group` hoort bij één board en bevat memberships.
- Een lid kan in meerdere groepen zitten.
- `shared-with` accepteert zowel losse leden als groepen.
- Groepen kennen géén eigen rechten.
- Alleen een `owner` kan groepen aanmaken en beheren.

**Standaardpubliek per board**
Elk board heeft een instelbaar standaardpubliek voor nieuwe items. Zo is vergeten in te stellen veilig in plaats van lekkend.

### 4.4 Uitnodigingen ✅

- Uitnodigen gaat **op e-mailadres van een bestaande gebruiker**. Beide partijen hebben de app al.
- Bestaat het adres niet als account? Dan faalt de uitnodiging met een duidelijke melding. Geen wachtende uitnodigingen voor onbekende adressen.
- De ontvanger moet de uitnodiging accepteren voordat de membership actief wordt.
- ⬜ Vervalt een openstaande uitnodiging na verloop van tijd?

### 4.5 Vertrek en verwijdering ✅

**Een member verlaat een board**
- Een member kan zichzelf uit een board verwijderen.
- Alle items waarvan hij eigenaar is worden **permanent verwijderd**.
- Alle toewijzingen aan hem vervallen; die items blijven bestaan zonder toegewezen lid.

**Een owner verlaat een board**
- Alleen mogelijk als er ten minste één andere owner is. Een board houdt altijd minimaal één owner.
- Verder identiek aan het vertrek van een member.

**Account verwijderen**
- Alles waarvan de gebruiker eigenaar is wordt verwijderd.
- Alle toewijzingen aan hem vervallen.

**Waarschuwingen zijn verplicht**
Verwijdering is permanent en raakt data van anderen. Elke actie hierboven vereist een expliciete bevestiging die benoemt wát er verdwijnt en hoeveel — niet een generiek "weet je het zeker?".

#### Twee gevolgen om te beslissen ⬜

1. **Ben je enige owner van een board, wat gebeurt er dan bij accountverwijdering?**
   Letterlijk toegepast verdwijnt het hele board, inclusief alles wat andere leden erin hebben staan. Alternatieven: verwijdering blokkeren tot het eigenaarschap is overgedragen, of gedwongen overdracht aan een ander lid.

2. **Board-brede items van een vertrekkend lid verdwijnen mee.**
   Heeft een ouder "zwemles dinsdag" aangemaakt en vertrekt die, dan is het voor iedereen weg — terwijl het gedeelde afspraken waren. Alternatief: items met `visibility: board` overdragen aan een owner in plaats van verwijderen, en alleen `private` en `shared-with` items daadwerkelijk wissen.

   Kanttekening: het recht op verwijdering onder de AVG betreft persoonsgegevens, niet per se alle content die iemand in een gedeelde ruimte heeft aangemaakt. Overdragen is dus verdedigbaar.

### 4.6 Zichtbaarheid — samenvatting

Twee onafhankelijke assen per item:
- `visibility`: `board` | `private` | `shared-with[]`
- `revealOwner`: `boolean` (default `true`)

---

## 5. Tech stack 🟡

**Vastgelegd**
- Frontend: Vite + Vue 3 + TypeScript, Pinia, Composition API (PWA)
- Distributie: Android-app via Capacitor, daarnaast te hosten als web-app
- Eén codebase voor beide targets
- **Backend: Supabase (Postgres).** Reden: de MVP is vrijwel volledig autorisatie. Met row-level security staan `visibility` en de rolmatrix als policies bij de data in plaats van herhaald in elke endpoint.
- **Auth: Supabase Auth**, hangt direct aan de RLS-policies
- **Push: Firebase Cloud Messaging via Capacitor**, met web push als fallback voor de gehoste variant
- **UI: Tailwind + headless componenten**, geen complete componentbibliotheek — de UX is de differentiator en mag niet door een library gedicteerd worden
- **Realtime: Supabase Realtime** (zie 3.3, buiten MVP)
- **Hosting frontend: Firebase Hosting** (statisch)
- **Testing frontend: Vitest**, specfiles naast de bestanden die ze testen (zie 9.5)
- **Regio: West-Europa** voor alle infrastructuur — database, functies, hosting en back-ups

**Nog te bepalen**
- Niets meer op stackniveau; CI en omgevingen staan in 9.8

**Expliciet niet**
- **Local-first / offline-editing.** De app gaat uit van een netwerkverbinding. Eventuele caching is hooguit leescomfort, geen synchronisatiemodel. Dit voorkomt een hele klasse aan conflictafhandeling.

> Let op: verifieer de actuele stand van Supabase en Capacitor bij aanvang van de bouw. Dit advies kan achterlopen.

---

## 6. Architectuur 🟡

### 6.1 Frontend-basis ✅
- Vite + Vue 3 + TypeScript
- **Composition API, geen Options API** — geldt als harde conventie
- Pinia voor state
- Composables voor herbruikbare logica
- Hosting: Firebase Hosting (statisch); Supabase levert data en auth

### 6.2 Mappenstructuur (voorstel)
Domeingericht in plaats van technisch gelaagd:

```
src/
  modules/
    auth/
    boards/        # board, membership, groepen
    items/         # taken/agenda-items
    invitations/
  shared/
    ui/            # generieke componenten
    composables/
    lib/           # supabase client, utils
    types/
  router/
  stores/          # alleen cross-cutting state
  app/             # entry, providers, layout
```

Elke module bevat zijn eigen `components/`, `composables/`, `api/` en `types/`. Domeingrenzen worden bewaakt: modules praten met elkaar via expliciete exports, niet dwars door elkaars interne bestanden.

### 6.3 Datatoegang ✅
- **Geen `supabase`-aanroepen in componenten.** Elke module heeft een dunne repository-laag (`items/api/itemRepository.ts`) die queries bevat.
- Componenten en composables praten alleen met die laag. Voordeel: testbaar, en RLS-gedrag zit op één plek.
- TypeScript-types worden **gegenereerd uit het Postgres-schema** (`supabase gen types typescript`). Het schema is de bron van waarheid, niet handgeschreven interfaces.

### 6.4 State: Pinia + eigen composables ✅

**Besluit: Pinia, met eigen fetch-composables per module.** Geen aparte servercache-library. Voor deze omvang is dat een dependency en een conceptlaag die zich niet terugverdient, en bij realtime wordt de waarheid geduwd in plaats van gepolld — dan is een store die de stream verwerkt precies de juiste plek.

Afspraak: **een store bevat óf clientstate óf serverdata van één domein, nooit allebei door elkaar.**

- Clientstate: sessie, actief board, filters, UI-voorkeuren
- Serverdata: items, boards, leden — per domein een eigen store, gevoed door de repository-laag (6.3)

#### Hersynchronisatieregels (verplicht)
Het echte vraagstuk is niet waar de data leeft, maar wanneer je hem niet meer mag vertrouwen. Deze regels gelden ongeacht de gekozen tooling:

1. **Snapshot en stream mogen geen gat laten.** Volgorde: eerst abonneren, binnenkomende events bufferen, dan de snapshot ophalen, dan de buffer toepassen. Toepassen is idempotent op `id` + `updated_at`.
2. **Volledige refetch van het actieve board bij reconnect en bij app-resume.** Een mobiele app verliest voortdurend verbinding — scherm op slot, achtergrond, wisselend netwerk. Gemiste realtime-berichten worden niet vanzelf ingehaald, dus na elke onderbreking is de store mogelijk stil verouderd.
3. **Verlies van toegang komt niet als event binnen.** Wordt een item op `private` gezet of word je uit een board verwijderd terwijl je het open hebt, dan wordt die wijziging tegen jouw RLS-policies gecheckt — en omdat je de nieuwe versie niet mag zien, ontvang je hem niet. De store houdt de oude, zichtbare kopie vast en blijft die tonen.

   **Dit is geen verversingsbug maar een privacylek in de UI**, en het raakt het zichtbaarheidsmodel uit 3.2 direct. Afdekking: regel 2 (periodiek en bij resume hersynchroniseren) plus, voor intrekking van boardtoegang, een expliciet signaal op een kanaal dat wél doorkomt.

> Verifieer bij aanvang van de bouw hoe Supabase Realtime omgaat met gemiste berichten en met rijen die door RLS buiten beeld raken. Dit gedrag kan sinds het opstellen van dit document gewijzigd zijn.

### 6.5 Board-context ✅
Het actieve board is cross-cutting. Voorstel: **boardId in de route** (`/b/:boardId/...`), niet alleen in een store.

- Deeplinks en notificaties kunnen direct naar het juiste board wijzen
- Elke query is expliciet board-scoped, wat aansluit bij "elke check is (user, board)"
- De store houdt hooguit het laatst gebruikte board bij voor de landingspagina

### 6.6 Database en policies ✅
- SQL-migraties in de repo, onder versiebeheer
- RLS-policies zijn **code**, geen klikwerk in de Supabase-UI
- De autorisatiematrix uit 4.2 is de testspec: per rol, per actie een test tegen de echte database met een echt JWT

### 6.7 Capacitor-specifiek ⬜
- Auth-redirects in een Capacitor-webview vergen aparte afhandeling (deeplink-scheme, `appUrlOpen`). Dit is een bekend struikelblok — vroeg inrichten.
- Configuratie en environment variables verschillen tussen de web- en Android-build.

### 6.8 Foutafhandeling bij rechten ✅
RLS filtert stil: een item dat je niet mag zien, bestaat voor jou simpelweg niet. Daardoor is "niet gevonden" en "geen toegang" hetzelfde antwoord.

Dat is veilig — het lekt geen bestaan — maar verwarrend als een deeplink naar een board mislukt. Vastleggen: **de UI toont één neutrale melding**, zonder onderscheid tussen bestaat-niet en mag-niet. Bewuste keuze, niet een gat.

---

## 7. Design 🟡

> Deze sectie is bedoeld als briefing voor een designtool. Ze beschrijft richting en beperkingen, geen kant-en-klare schermen.

### 7.1 Gebruikscontext ✅
- Mobiel-first. De app wordt onderweg gebruikt: in de auto, langs het sportveld, in de supermarkt.
- Vaak haastig, vaak met één hand, vaak in fel daglicht.
- Gevolg: primaire acties binnen duimbereik, hoog contrast, ruime aanraakvlakken.

### 7.2 Visuele toon ✅
**Rustig en strak.** Geen speelse gezinsillustraties, geen drukke iconografie.
**Ruim boven compact:** liever minder op één scherm en dat volstrekt duidelijk, dan alles tegelijk.

Reden: de app bestaat om mentale ruimte terug te geven. Een druk scherm werkt dat tegen, hoe efficiënt het ook is.

### 7.3 Kleurstrategie ✅
Kleur draagt betekenis op meerdere assen — maar elk via een eigen kanaal, anders wordt het bont:

| As | Kanaal | Toelichting |
|---|---|---|
| Board | App-chrome (header, accent) | Je bent altijd in één board tegelijk. Kleurt nooit losse items. |
| Lid | Avatar / initiaal | Klein en consistent. Niet als rand of achtergrond van een item. |
| Item | Smalle accentbalk links | Optioneel, door de gebruiker zelf te kiezen. |

**Itemkleur**
De gebruiker kan een item optioneel een kleur geven. Voorwaarden:
- **Klein vast palet**, geen vrije kleurkiezer. Anders botst een zelfgekozen kleur met de lid- en boardkleuren en vervaagt de betekenis.
- Eigen kanaal (accentbalk), niet gedeeld met lid of board.
- De app hangt er **geen betekenis** aan. Het is persoonlijke markering; de gebruiker bepaalt zelf wat rood betekent.

Basispalet blijft neutraal. Kleur is signaal, geen decoratie.

**Donkere modus: vanaf het begin meeontwerpen** ✅ — niet achteraf. Met tokens (7.9) kost dat nu weinig en later veel.

### 7.4 Typografie ✅
**Roboto** (of Roboto Flex als variabele variant). Modern en strak, en het systeemlettertype van Android — de app voelt daardoor native op het primaire platform, met uitstekende leesbaarheid op klein formaat.

Overweging: Roboto oogt generiek. Dat is hier acceptabel — dit is gereedschap voor eigen gebruik, geen merk. Alternatief met iets meer karakter en vergelijkbaar risico: Inter.

- Beperkte schaal: 3 tot 4 groottes
- Nadruk via gewicht en witruimte, niet via kleur

### 7.5 Dichtheid en aanraakvlakken ✅
- Ruime regelafstand, duidelijke scheiding tussen items
- Aanraakvlakken minimaal 44×44 px
- Primaire acties onderin het scherm, binnen duimbereik

### 7.6 Kernschermen (te ontwerpen)
1. Boards-overzicht
2. Board — vandaag/deze week
3. Board — agenda
4. Board — to-do's (items zonder datum)
5. Item aanmaken (snelle capture)
6. Item detail en bewerken
7. Leden en groepen beheren
8. Uitnodigen

### 7.7 App-specifieke ontwerpvraagstukken ✅
Dit is waar het echte designwerk zit. Geen template lost deze op.

**Snelle capture in seconden**
Eén veld, bereikbaar vanaf elk scherm, eenhandig te bedienen. Dit bepaalt de navigatiestructuur, niet andersom. Alles behalve de titel is optioneel en komt achteraf.

**Zichtbaarheid tonen zonder te schreeuwen**
In één oogopslag zien dat iets privé is of met een subset gedeeld — zonder dat elk item vol badges staat. Het merendeel van de items is `board`; die toestand verdient géén markering. Alleen afwijkingen krijgen een teken.

**Het bezet-blok**
Een blok zonder inhoud in de agenda moet rustig ogen en niet gelezen worden als fout, als laadstatus of als lege plek. Het is een geldige, complete toestand.

### 7.8 Toegankelijkheid ✅

**Norm: WCAG 2.2 niveau AA**, met EN 301 549 als kader (hoofdstuk 11, niet-web software, is voor een mobiele app relevant naast het webhoofdstuk).

Juridische nuance: de European Accessibility Act geldt voor producten en diensten die aan consumenten op de markt worden aangeboden. Zolang de app alleen voor het eigen gezin is, valt hij daar formeel buiten. Maar distributie via de Play Store staat op tafel (zie 8), en dan gelden de eisen wél. Daarom wordt de norm vanaf het begin aangehouden — achteraf toegankelijk maken kost een veelvoud. (Geen juridisch advies.)

In 2026 is EN 301 549 v3.2.1 de vigerende versie, die WCAG 2.1 AA overneemt; v4 met WCAG 2.2 wordt in 2026 verwacht. Daarom nu al op 2.2 AA mikken.

**Concrete consequenties voor dit ontwerp**

- **Betekenis nooit uitsluitend via kleur.** Raakt zowel de lidkleur als de itemkleur uit 7.3 direct: beide altijd gepaard met tekst, initiaal of icoon. Zonder dat is de kleur decoratie voor de één en onzichtbaar voor de ander.
- Contrast: 4.5:1 voor tekst, 3:1 voor UI-componenten en grafische elementen. Geldt ook in donkere modus.
- Aanraakvlakken: WCAG 2.2 eist minimaal 24×24; wij houden 44×44 aan (7.5).
- Zichtbare focus, en focus mag niet door overlays worden afgedekt.
- Schaalbare tekst — respecteer de systeeminstelling voor lettergrootte, ook in de Capacitor-build.
- Alternatief voor sleepacties: als je items kunt verslepen (verplaatsen in de agenda, herordenen), moet er altijd een niet-slepende route zijn.
- Inloggen zonder cognitieve test: geen puzzels of geheugentoetsen, plakken van een wachtwoord moet werken.
- Schermlezer: betekenisvolle labels op elk interactief element, inclusief het bezet-blok ("bezet, 14:00 tot 15:30").

### 7.9 Design tokens ⬜
Kleur, spacing, radius, typografie als tokens vastleggen voordat er componenten worden gebouwd.

---

## 8. Non-functioneel 🟡

### Kwaliteitslat ✅
De app is productiewaardig en mag niet onderdoen voor bestaande commerciële alternatieven. Distributie via de Play Store is een reële optie voor later. Dat is geen detail: het zet een aantal eisen om van "netjes" naar "verplicht".

### Privacy — leidend principe ✅
**Data die niet voor een gebruiker bedoeld is, mag die gebruiker nooit bereiken.** Niet in een API-respons, niet in een realtime-event, niet in een pushbericht, niet in een cache, niet in een logregel.

Dit is geen wens maar de toetssteen voor elke ontwerpbeslissing. Concreet uitgewerkt in:
- 3.2 — zichtbaarheid per item, afgedwongen op de datalaag
- 3.5 — nooit domeininhoud in een notificatiepayload
- 6.4 — hersynchronisatie bij verlies van toegang
- 6.8 — geen onderscheid tussen "bestaat niet" en "geen toegang"

### Beslis nu, niet later ✅
Deze keuzes zijn vooraf bijna gratis en achteraf een migratie:

- **Alle infrastructuur in West-Europa.** Supabase-regio, Edge Functions, hosting en back-ups. Van regio wisselen betekent data migreren — doe dit bij het aanmaken van het project, niet later.
- **Geen persoonsgegevens in logs.** Log identifiers, geen titels, namen of e-mailadressen. Achteraf logregels opschonen is niet te doen.
- **Account verwijderen als functionaliteit.** De Play Store vereist voor apps met accountregistratie een route om het account te verwijderen, ook buiten de app om. Bouw het als functie, niet als handmatige databaseactie.
- **Migraties vanaf commit één.** Schema en RLS-policies onder versiebeheer (6.6), zodat je een tweede omgeving kunt opzetten zonder handwerk.

### Bij aanbieden aan derden ⬜
Wordt de app buiten het eigen gezin gebruikt, dan komt hierbij:

- Verwerkersovereenkomst met Supabase en met de hostingpartij
- Privacyverklaring en gebruiksvoorwaarden
- Data Safety-verklaring in de Play Store
- Rechten van betrokkenen: inzage, export, verwijdering
- Bewaartermijnen: wat gebeurt er met een board waarvan alle leden vertrokken zijn?
- Toegankelijkheid wordt een **eis** in plaats van een kwaliteitslat (zie 7.8)

### Betrouwbaarheid ⬜
- Foutregistratie in de client, zonder persoonsgegevens
- Back-upstrategie en herstelprocedure beproeven, niet aannemen
- Aparte omgeving voor ontwikkeling en productie

### Overig ⬜
Performance-budgetten.

---

## 9. Instructies voor de bouwsessie ✅

> Deze sectie is geschreven om als context aan een codeerassistent te worden meegegeven. Ze bevat regels, geen uitleg.

### 9.1 Lees dit eerst
- De autorisatiematrix (4.2) en het privacyprincipe (8) zijn bindend. Alles wat daarmee botst, is fout — ook als het werkt.
- Bij twijfel over scope: alleen bouwen wat in de MVP-lijst (2) staat.
- Vraag om verduidelijking in plaats van een aanname te doen over rechten, zichtbaarheid of datamodel.

### 9.2 Codeconventies
- TypeScript in `strict`-modus. Geen `any`, geen `@ts-ignore` zonder toelichting in de code.
- **Composition API met `<script setup>`. Options API is niet toegestaan.**
- Databasetypes worden gegenereerd (`supabase gen types typescript`), nooit handmatig geschreven.
- Geen `supabase`-aanroepen in componenten of stores — alleen in de repository-laag van een module (6.3).
- Eén store bevat óf clientstate óf serverdata van één domein (6.4).
- Nederlands in de UI, Engels in code en commits.
- Geen nieuwe dependency zonder dat expliciet voor te leggen.

### 9.3 Harde regels
1. **Elke query is board-scoped.** Autorisatie is altijd (user, board), nooit alleen user.
2. **Zichtbaarheid wordt in de database afgedwongen**, via RLS-policies. Filteren in de frontend is geen implementatie maar een bug.
3. **Nooit domeininhoud in een notificatiepayload** (3.5).
4. **Geen persoonsgegevens in logs** — identifiers wel, titels en e-mailadressen niet.
5. **Geen onderscheid tussen "bestaat niet" en "geen toegang"** in foutmeldingen (6.8).
6. **Betekenis nooit uitsluitend via kleur** (7.8).
7. **Alle infrastructuur in West-Europa.** Database, functies, hosting en back-ups.

### 9.4 Werkwijze per taak
1. Migratie eerst: schemawijziging en RLS-policy in hetzelfde migratiebestand.
2. Types opnieuw genereren.
3. Repository-laag, dan composable, dan component.
4. Tests bij de wijziging, niet erna. Specfile naast het bestand.
5. Kleine, afgeronde eenheden. Liever vijf kleine wijzigingen dan één grote.

### 9.5 Teststrategie

**Frontend: Vitest** ✅
- **Elk bestand en elke functionaliteit wordt getest.** Geen ongeteste modules.
- Specfiles staan **in dezelfde map als het bestand dat ze testen**, niet in een aparte `tests/`-boom. Dus `itemRepository.ts` naast `itemRepository.spec.ts`.
- Componenten, composables, stores en repositories vallen hier allemaal onder.
- **Elke test volgt Arrange, Act, Assert** — in die volgorde, zichtbaar gescheiden in de test. Eén handeling per test; is er een tweede Act nodig, dan is het een tweede test.

**Database: RLS-policytests** ✅
- **Niet optioneel.** De matrix uit 4.2 is de testspec: per rol, per actie, tegen de echte database met een echt token.
- Een policy zonder test geldt als niet aanwezig.
- Dit is een andere testlaag dan Vitest — hier wordt de database zelf getoetst, niet de client.

**End-to-end**
- Kritieke paden: registreren, board aanmaken, uitnodigen, item aanmaken met beperkte zichtbaarheid.
- Eén expliciete test voor het bezet-blok: een lid zonder toegang ontvangt tijdvak en eventueel eigenaar, en geen enkel inhoudelijk veld.

### 9.6 Definition of done
Een taak is af als:
- De code voldoet aan 9.2 en 9.3
- Migraties en policies in de repo staan en zijn getest
- De relevante rijen uit de autorisatiematrix zijn afgedekt met tests
- Toegankelijkheid is gecontroleerd: contrast, focus, aanraakvlak, schermlezerlabel
- Zowel de webbuild als de Android-build draait
- Er geen persoonsgegevens in logs of foutmeldingen terechtkomen

### 9.7 Startpunt van de bouwsessie ✅

Het design is uitgewerkt in Claude Design en dekt vrijwel alle features. Importeer dat als eerste stap, vóór er code wordt geschreven:

```
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/10c47ab8-a7f9-4bd8-b90c-9d55ca92307e?file=Gezinsorganisatie+App.dc.html

Implement: Gezinsorganisatie App.dc.html
```

Let op bij het omzetten van het design naar code:
- Het design is de bron voor **vorm**, dit document voor **gedrag en rechten**. Botsen ze, dan wint dit document — en meld de discrepantie.
- Design tokens (7.9) uit het importresultaat overnemen als tokens, niet als losse waarden verspreid over componenten.
- Het geïmporteerde HTML-bestand is een designartefact, geen applicatiestructuur. Componenten volgen de mappenstructuur uit 6.2.
- Toegankelijkheidseisen (7.8) gelden ook voor gegenereerde markup; controleer ze expliciet in plaats van aan te nemen dat het import goed staat.

### 9.8 Omgevingen en releaseproces ✅

**Branches**

| Branch | Doel | Omgeving |
|---|---|---|
| `feature/*` | Losse wijziging, kortlevend | Geen |
| `develop` | Integratie en feature-testing | Development |
| `main` | Productie | Productie |

**Stroom**
1. Feature branch vanaf `develop`, PR terug naar `develop`. CI moet groen zijn.
2. Merge naar `develop` deployt automatisch naar de development-omgeving.
3. Daar vindt QA plaats: functioneel testen, toegankelijkheidscontrole, controle tegen de autorisatiematrix.
4. Pas na goedkeuring een PR van `develop` naar `main`, met code review.
5. Merge naar `main` deployt naar productie.

**Twee volledige omgevingen**
Development en productie hebben elk een eigen Supabase-project — beide in West-Europa. Dat is niet optioneel: RLS-policies en migraties moeten ergens getest kunnen worden voordat ze bij echte gezinsdata komen.

- Migraties draaien altijd eerst op development.
- Een migratie die al op productie is toegepast wordt nooit meer bewerkt; corrigeren gebeurt met een nieuwe migratie.
- Firebase Hosting: aparte site of hosting target per omgeving.
- Android: development-build met een afwijkende `applicationId`, zodat beide versies naast elkaar op één toestel kunnen staan.

**Geen productiedata in development** ✅
De development-omgeving wordt gevuld met seed data, nooit met een kopie van productie. Productie bevat de gegevens van echte gezinnen; die horen niet in een omgeving met lossere toegang. Dit volgt rechtstreeks uit het privacyprincipe in 8.

**CI per gebeurtenis**

| Gebeurtenis | Actie |
|---|---|
| PR naar `develop` of `main` | Lint, typecheck, Vitest, build |
| Merge naar `develop` | Migraties + deploy naar development |
| Merge naar `main` | Migraties + deploy naar productie |

⬜ RLS-policytests toevoegen aan CI zodra het beleid staat: tegen een wegwerp-Supabase-instantie, niet tegen development.

### 9.9 Wat niet zonder overleg wordt besloten
- Wijzigen van de stack of toevoegen van dependencies
- Versoepelen of omzeilen van een RLS-policy, ook tijdelijk voor debugdoeleinden
- Uitbreiden van het datamodel
- Toevoegen van features buiten de MVP-lijst
- Gebruik van de service key in code die door de client wordt aangeroepen

---

## Open vragen

1. Enige owner die zijn account verwijdert — board mee verwijderen, of blokkeren tot overdracht? (4.5)
2. Board-brede items van een vertrekkend lid — verwijderen of overdragen? (4.5)
3. Vervalt een openstaande uitnodiging na verloop van tijd? (4.4)
4. User stories en acceptatiecriteria voor items (3.1)
5. Capacitor: auth-redirect en environment per build (6.7)
6. Design tokens (7.9)
7. RLS-policytests in CI (9.8)
