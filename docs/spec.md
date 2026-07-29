# Household Organiser — Specification

> Living document. Status per section: ✅ settled · 🟡 in progress · ⬜ to do
> Purpose: this document serves as context and instruction for actually building the app.
>
> These markers describe **spec completeness**, not implementation. For what is
> actually built — UI vs database-only, and what is deferred — see
> [`STATUS.md`](STATUS.md).

---

## 1. Product ✅

**Problem**
In a busy household, coordination — who does what, who drives whom, what is coming up this week — is scattered across people's heads, chat threads and separate calendars. That costs mental capacity and leads to an uneven distribution of the load, and to friction.

**Audience**
- Primary: the adults running a household together
- Secondary: other members of a board, who see what is relevant to them

**Core promise**
One shared view that makes the invisible load visible and fairly divided.

**Core value**
Intuitive UX that helps a household get and keep its life in order, so that cooperation and affection within the household are preserved.

**Differentiator**
Existing apps (Cozi, FamilyWall, Skylight) are task lists with a family theme. This app differs on two points:
1. **Offloading rather than recording** — whatever is in your head is in the app within seconds, and anything recurring no longer needs anyone to watch it.
2. **Taking privacy inside the household seriously** — a shared board does not mean everything is shared. Visibility per item, with a calendar that stays usable.

Explicitly **not** a differentiator: measuring distribution or fairness. See 3.5.

**Success criterion**
The household uses the app without anyone needing to be reminded it exists.

**Context**
- Built for the author's own household, initially non-commercial
- Quality bar is production-grade: it must not fall short of commercial alternatives
- Distribution through the Play Store is a realistic option later. That already steers several choices (see 8).
- The domain deliberately carries **no family semantics**. A board is a shared environment, not a family. Permissions follow from roles, not from relationships.

---

## 2. Scope 🟡

### MVP ✅
The foundation is authorisation and structure — not breadth of features. Concretely:

1. **Account** — register and sign in
2. **Create boards** — a user creates one or more boards
3. **Boards overview** — switch between boards
4. **Invite members** — by email address, by an owner, within a board
5. **Create items** — within a board, with visibility, with or without a date, with an optional colour from a fixed palette
6. **Data synchronisation** — fetching at the logical lifecycle moments, plus a sync button as an extra (see 3.4)

Rationale: once the permissions and board foundation is in place, every further feature is an addition rather than a rebuild.

### Later / explicitly out of scope
- Realtime board updates (see 3.3)
- Push and local notifications (see 3.4)
- Lists (groceries and similar) as a separate entity type
- Recurring items (see 3.5.2)
- External calendar integration

### Explicitly not
- Distribution overviews, fairness scores, points, streaks or leaderboards (see 3.5)
- Local-first / offline editing (see 5)

---

## 3. Features 🟡

### 3.1 Items: tasks and calendar in one model ✅

There is no separate "task" and "calendar" type. A single `Item` entity, whose date determines its behaviour:

- **Item with a date/time** → appears in the calendar
- **Item without a date** → sits in the to-do list, to be ticked off whenever it suits

Benefits: one data model, one form, and a to-do can become a scheduled appointment simply by attaching a date — no conversion.

A point to watch later: not everything in a calendar is "completable" (a birthday is never done). If that starts to grate in the UI, a lightweight `type` hint on `Item` is the cheapest way out — not a second entity.

⬜ User stories + acceptance criteria

### 3.2 Per-item visibility ✅

Not everything on a shared board needs to be visible to everyone.

- Every item has a `visibility`:
  - `board` — visible to all members with read access to board-wide items (default)
  - `private` — owner only
  - `shared-with` — an explicit subset of members and/or groups
- **Enforced at the data layer, not in the UI.** The client simply never receives items the user is not allowed to see.

**Busy block** ✅
A private item that claims time in the calendar appears as a block without content.

- **Time precision:** exact time (e.g. 14:00–15:30). This keeps the calendar usable for planning.
- **Owner:** configurable per item — the creator decides whether their name appears on the block.
- **Content:** never visible. Title, notes, location and participants are never delivered to the client.
- **Default:** show the owner. That is the useful case; anonymising is the deliberate exception.
- Note: on a board with two adults, an anonymous block still gives away who it is almost every time. Anonymity here is soft privacy, not a hard guarantee — do not promise it too firmly in the UI.

### 3.3 Realtime board updates ✅ (outside MVP)

When one member adds an item, it appears immediately for every other member who has the same board open — without refreshing.

- Deliberately **outside the MVP**, but the stack choice accommodates it: Supabase Realtime listens to Postgres changes and respects RLS, so the same policies govern the stream.
- **Watch out:** the busy block is a derived projection, not a row in the database. A naive realtime stream could emit the full row for a private item. Two safe routes:
  1. Use realtime purely as a *signal* ("something changed") and let the client refetch through the normal, projected query.
  2. Publish a separate view or channel containing only the projected fields.

  Route 1 is simpler and less error-prone; route 2 is more efficient. The decision is only needed at implementation time.
- ⬜ Presence ("who else is looking") is explicitly not part of this.
- See 6.4 for the resynchronisation rules. Those are not an implementation detail: without them the app shows silently stale data after a dropped connection, including items whose access has since been revoked.

### 3.4 Notifications and synchronisation 🟡

#### MVP: fetching at lifecycle moments ✅
Data is fetched at the logical moments in the app's lifecycle. That is baseline behaviour, not a feature:

- on sign-in and when opening a board
- when navigating to a screen that needs the data
- on app resume and on network reconnection
- after every mutation

**In addition**, a sync button, as an explicit escape for a user who expects something and does not want to wait. Extra, not instead of the above.

Realtime (3.3) is layered on top of this later and does not replace it — the resynchronisation rules in 6.4 continue to apply.

#### Later: local notifications
Reminders for items with a date are **local** notifications (`@capacitor/local-notifications`). No server, no token registry, no FCM. This probably covers most of the value.

#### Later: push (FCM)
Only needed for events originating from another member: an item assigned to you, an invitation.

- On Android, FCM is the transport layer, not a choice. Services like OneSignal also deliver through FCM and merely add a vendor.
- Distributing outside the Play Store is no obstacle: FCM requires Google Play Services on the device, not distribution through the store.
- Route: database webhook on a `notifications` table → Supabase Edge Function → FCM HTTP v1.
- The web version needs no Firebase for this: standard Web Push with VAPID is enough.

#### Hard rule: never put domain content in a push message ✅
An Edge Function runs with the service key and **bypasses RLS entirely**. Put an item title in the notification text and the content of a private item lands on someone else's lock screen — and passes through Google on the way. The visibility model then leaks through the one channel that does not run through it.

- The payload contains only a neutral indicator ("New item in Home") or is data-only.
- The app always fetches the content through the normal, RLS-filtered query.
- This applies to local notifications on a shared device too.

### 3.5 Reducing mental load (not measuring it) ✅

**Starting point: the app reduces the load, it does not measure it.**
No distribution overview, no percentages, no leaderboard, no fairness score. Reason: in practice such a dashboard becomes ammunition in an argument and damages exactly what the app is meant to protect. The gain is in *offloading*, not in *demonstrating*.

#### 3.5.1 Quick capture
Half the mental load consists of things written down nowhere ("the shoes are getting too small"). If it is not in the app within seconds, it stays in someone's head.

- One input field. The only required field is the title.
- Date, assignment and visibility are optional and can be filled in afterwards.
- Visibility falls back to the board's default audience.
- Reachable from every screen.
- To consider later: Android share target, home screen widget, voice input.

#### 3.5.2 Recurring items (outside MVP)
Once the app remembers something, nobody has to watch it any more. This lowers the load directly rather than putting it on display.

- `recurrence` on `Item`.
- ⬜ Generate instances up front or derive them virtually?
- ⬜ What happens when one is skipped?
- ⬜ Editing a single instance versus the whole series?

#### 3.5.3 Acknowledgement
A lightweight confirmation on a completed item — "seen, thank you".

- **Explicitly no** points, streaks, badges or totals. The moment appreciation becomes countable it is a score, and we are back at the leaderboard.
- Always optional. Its absence must never be presented as a signal — so no reminders along the lines of "you haven't said thanks yet".
- ⬜ Notification on acknowledgement, or silent?

---

## 4. Business logic & domain model 🟡

### 4.1 Entities

| Entity | Description |
|---|---|
| `User` | An app account. Exists independently of boards. |
| `Board` | A shared environment. A user can have several. |
| `Membership` | Link between `User` and `Board`. Carries the role. |
| `Group` | A named collection of memberships within one board. An audience, not a permission level. |
| `Item` | Task or calendar item within a board. Carries `visibility` + `revealOwner`. |
| `Invitation` | An outstanding invitation for an existing user. |

**Fields on `Item` (indicative)**
`title`, `notes`, `assigneeId`, `startsAt?`, `endsAt?`, `allDay`, `isDone`, `visibility`, `sharedWith[]`, `revealOwner`, `createdBy`

`color?` — optional item colour from a small fixed palette (see 7.3). Part of the MVP. Carries no application-level meaning; purely personal marking. Never the sole carrier of meaning (see 7.8).

### 4.2 Roles and authorisation ✅

Three roles: `owner`, `member`, `guest`.

- **The role attaches to the `Membership`, not the `User`** — someone can be owner of board A and member of board B. Every check is therefore always (user, board).
- No relationship semantics. Whether someone is a child, a parent or a neighbour is irrelevant to permissions. That is deliberate: relationships are slippery, roles are testable.
- A board can have several owners and must always retain at least one.

**Authorisation matrix**

| Action | `owner` | `member` | `guest` |
|---|:--:|:--:|:--:|
| Change board settings | ✅ | ❌ | ❌ |
| Delete board | ✅ | ❌ | ❌ |
| Invite / remove members | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Manage groups | ✅ | ❌ | ❌ |
| See board-wide items | ✅ | ✅ | ❌ |
| See items shared with them | ✅ | ✅ | ✅ |
| Create items | ✅ | ✅ | ✅ |
| Edit / delete own items | ✅ | ✅ | ✅ |
| Edit other members' items | ✅ | ✅ | ❌ |
| Assign an item to another member | ✅ | ✅ | ❌ |

The matrix is the *role* permission. Two rows carry an extra constraint beyond the role, detailed in 4.5: **Delete board** is allowed only when no other members remain, and **remove members / leaving** delete the departing person's private items while keeping the rest (an owner hands theirs to a receiving owner).

**The `guest` role**
Sees only what has been explicitly shared with them or assigned to them. This handles "not everyone needs to see everything" at role level rather than per item — without a word about family relationships. Useful for a younger child, a babysitter, or a grandparent involved only in the school run.

This matrix doubles as the test specification: every row is a test, per role.

### 4.3 Groups ✅

Groups are an **audience, not a permission level**. They exist to make visibility quick to set, not to introduce a second authorisation axis.

- A `Group` belongs to one board and contains memberships.
- A member can be in several groups.
- `shared-with` accepts both individual members and groups.
- Groups carry no permissions of their own.
- Only an `owner` can create and manage groups.

**Default audience per board**
Every board has a configurable default audience for new items. That way, forgetting to set it is safe rather than leaky.

### 4.4 Invitations ✅

- Invitations go **to the email address of an existing user**. Both parties already have the app.
- If the address is not a known account, the invitation fails with a clear message. No pending invitations for unknown addresses.
- The recipient must accept the invitation before the membership becomes active.
- ⬜ Does an outstanding invitation expire?

### 4.5 Leaving and deletion ✅

**A member leaves a board**
- A member can remove themselves from a board.
- Their **private** items are permanently deleted.
- All their other items **stay on the board** unchanged; assignments to them are cleared (those items remain, without an assignee).

**An owner leaves a board**
- Only possible while at least one other owner remains — a board always keeps at least one owner.
- The leaving owner nominates a **receiving owner**. Their **private** items are deleted; every other item they created (board- and selection-visible, assigned or not) is **re-owned by the receiving owner**, with assignees kept.
- A sole owner must first appoint another owner before they can leave.

**Deleting a board**
- An owner may delete a board **only when no other members remain**, so no one else's content is taken with it. The board and everything in it are then permanently removed.
- While others are still present, deletion is not offered; an owner leaves (handing over items) instead.

**Account deletion**
- Everything the user owns is deleted; all assignments to them are cleared. This is the blunt "erase everything I created" path, distinct from leaving a single board (which hands over or keeps shared content).

**Warnings are mandatory**
Deletion is permanent and affects other people's data. Every action above requires an explicit confirmation that names *what* disappears and how much — not a generic "are you sure?".

#### Resolved

1. **Sole owner and board deletion.** A board is deleted only when its owner is the last member. While others remain, ownership is handed over — an owner leaves and nominates a receiver — rather than the board vanishing under everyone.

2. **A departing person's shared content.** Board- and selection-visible items are **kept**: re-owned to the receiving owner when an owner leaves, or left in place when a member leaves. Only **private** items are erased. This matches the GDPR view that erasure concerns personal data, not all content created in a shared space.

### 4.6 Visibility — summary

Two independent axes per item:
- `visibility`: `board` | `private` | `shared-with[]`
- `revealOwner`: `boolean` (default `true`)

---

## 5. Tech stack 🟡

**Settled**
- Frontend: Vite + Vue 3 + TypeScript, Pinia, Composition API (PWA)
- Distribution: Android app via Capacitor, plus hosting as a web app
- One codebase for both targets
- **Backend: Supabase (Postgres).** Reason: the MVP is almost entirely authorisation. With row-level security, `visibility` and the role matrix live as policies next to the data instead of being repeated in every endpoint.
- **Auth: Supabase Auth**, tied directly to the RLS policies
- **Push: Firebase Cloud Messaging via Capacitor**, with web push as the fallback for the hosted variant
- **UI: Tailwind + headless components**, no full component library — the UX is the differentiator and must not be dictated by a library
- **Realtime: Supabase Realtime** (see 3.3, outside MVP)
- **Frontend hosting: Firebase Hosting** (static)
- **Frontend testing: Vitest**, spec files alongside the files they test (see 9.5)
- **Region: Western Europe** for all infrastructure — database, functions, hosting and backups

**Still to determine**
- Nothing at stack level; CI and environments are covered in 9.8

**Explicitly not**
- **Local-first / offline editing.** The app assumes a network connection. Any caching is read comfort at most, not a synchronisation model. This avoids an entire class of conflict resolution.

> Note: verify the current state of Supabase and Capacitor when starting the build. This advice may lag behind.

---

## 6. Architecture 🟡

### 6.1 Frontend baseline ✅
- Vite + Vue 3 + TypeScript
- **Composition API, no Options API** — a hard convention
- Pinia for state
- Composables for reusable logic
- Hosting: Firebase Hosting (static); Supabase provides data and auth

### 6.2 Folder structure (proposed)
Domain-oriented rather than technically layered:

```
src/
  modules/
    auth/
    boards/        # board, membership, groups
    items/         # tasks / calendar items
    invitations/
  shared/
    ui/            # generic components
    composables/
    lib/           # supabase client, utils
    types/
  router/
  stores/          # cross-cutting state only
  app/             # entry, providers, layout
```

Each module contains its own `components/`, `composables/`, `api/` and `types/`. Domain boundaries are guarded: modules talk to each other through explicit exports, never by reaching into each other's internal files.

### 6.3 Data access ✅
- **No `supabase` calls in components.** Every module has a thin repository layer (`items/api/itemRepository.ts`) holding the queries.
- Components and composables talk only to that layer. Benefit: testable, and RLS behaviour lives in one place.
- TypeScript types are **generated from the Postgres schema** (`supabase gen types typescript`). The schema is the source of truth, not hand-written interfaces.

### 6.4 State: Pinia + own composables ✅

**Decision: Pinia, with per-module fetch composables.** No separate server cache library. At this size that is a dependency and a conceptual layer that does not pay for itself, and with realtime the truth is pushed rather than polled — at which point a store consuming the stream is exactly the right place.

Agreement: **a store holds either client state or server data for one domain, never both mixed together.**

- Client state: session, active board, filters, UI preferences
- Server data: items, boards, members — one store per domain, fed by the repository layer (6.3)

#### Resynchronisation rules (mandatory)
The real question is not where the data lives, but when it can no longer be trusted. These rules apply regardless of tooling:

1. **Snapshot and stream must not leave a gap.** Order: subscribe first, buffer incoming events, then fetch the snapshot, then apply the buffer. Applying is idempotent on `id` + `updated_at`.
2. **Full refetch of the active board on reconnect and on app resume.** A mobile app loses its connection constantly — screen locked, backgrounded, changing networks. Missed realtime messages are not replayed, so after every interruption the store may be silently stale.
3. **Loss of access does not arrive as an event.** If an item is set to `private`, or you are removed from a board while you have it open, that change is checked against your RLS policies — and because you are not allowed to see the new version, you never receive it. The store keeps the old, visible copy and carries on showing it.

   **This is not a refresh bug but a privacy leak in the UI**, and it touches the visibility model in 3.2 directly. Mitigation: rule 2 (resynchronise periodically and on resume) plus, for revocation of board access, an explicit signal on a channel that does get through.

> Verify at the start of the build how Supabase Realtime handles missed messages and rows that fall out of scope through RLS. This behaviour may have changed since this document was written.

### 6.5 Board context ✅
The active board is cross-cutting. Proposal: **boardId in the route** (`/b/:boardId/...`), not only in a store.

- Deep links and notifications can point straight at the right board
- Every query is explicitly board-scoped, which matches "every check is (user, board)"
- The store holds at most the last-used board, for the landing page

### 6.6 Database and policies ✅
- SQL migrations in the repository, under version control
- RLS policies are **code**, not clicking around in the Supabase UI
- The authorisation matrix in 4.2 is the test specification: per role, per action, a test against the real database with a real JWT

### 6.7 Capacitor specifics ⬜
- Auth redirects inside a Capacitor webview need separate handling (deep link scheme, `appUrlOpen`). This is a known stumbling block — set it up early.
- Configuration and environment variables differ between the web and Android builds.

### 6.8 Error handling for permissions ✅
RLS filters silently: an item you may not see simply does not exist for you. As a result, "not found" and "no access" are the same answer.

That is safe — it leaks no existence — but confusing when a deep link to a board fails. Settled: **the UI shows one neutral message**, with no distinction between does-not-exist and not-allowed. A deliberate choice, not a gap.

---

## 7. Design 🟡

> This section is written as a brief for a design tool. It describes direction and constraints, not finished screens.

### 7.1 Usage context ✅
- Mobile-first. The app is used on the move: in the car, at the sports field, in the supermarket.
- Often in a hurry, often one-handed, often in bright daylight.
- Consequence: primary actions within thumb reach, high contrast, generous touch targets.

### 7.2 Visual tone ✅
**Calm and clean.** No playful family illustrations, no busy iconography.
**Spacious over compact:** better to show less on a screen and have it be completely clear than to show everything at once.

Reason: the app exists to give mental capacity back. A busy screen works against that, however efficient it is.

### 7.3 Colour strategy ✅
Colour carries meaning on several axes — but each through its own channel, otherwise it turns garish:

| Axis | Channel | Notes |
|---|---|---|
| Board | App chrome (header, accent) | You are always in one board at a time. Never colours individual items. |
| Member | Avatar / initial | Small and consistent. Not as an item's border or background. |
| Item | Narrow accent bar on the left | Optional, chosen by the user. |

**Item colour**
A user can optionally give an item a colour. Conditions:
- **A small fixed palette**, not a free colour picker. Otherwise a self-chosen colour collides with the member and board colours and the meaning blurs.
- Its own channel (accent bar), not shared with member or board.
- The app attaches **no meaning** to it. It is personal marking; the user decides what red means.

The base palette stays neutral. Colour is signal, not decoration.

**Dark mode: designed in from the start** ✅ — not retrofitted. With tokens (7.9) that costs little now and a lot later.

### 7.4 Typography ✅
**Roboto** (or Roboto Flex as the variable version). Modern and clean, and Android's system typeface — which makes the app feel native on the primary platform, with excellent legibility at small sizes.

Consideration: Roboto looks generic. That is acceptable here — this is a tool for personal use, not a brand. An alternative with slightly more character and comparable risk: Inter.

- Limited scale: three to four sizes
- Emphasis through weight and whitespace, not colour

### 7.5 Density and touch targets ✅
- Generous line spacing, clear separation between items
- Touch targets at least 44×44 px
- Primary actions at the bottom of the screen, within thumb reach

### 7.6 Core screens (to be designed)
1. Boards overview
2. Board — today / this week
3. Board — calendar
4. Board — to-dos (items without a date)
5. Create item (quick capture)
6. Item detail and edit
7. Manage members and groups
8. Invite

### 7.7 App-specific design problems ✅
This is where the real design work sits. No template solves these.

**Quick capture in seconds**
One field, reachable from every screen, operable one-handed. This determines the navigation structure, not the other way round. Everything except the title is optional and comes afterwards.

**Showing visibility without shouting**
See at a glance that something is private or shared with a subset — without every item being covered in badges. The majority of items are `board`; that state deserves no marker at all. Only deviations get a sign.

**The busy block**
A block without content in the calendar must look calm and must not read as an error, a loading state or an empty slot. It is a valid, complete state.

### 7.8 Accessibility ✅

**Standard: WCAG 2.2 level AA**, with EN 301 549 as the framework (chapter 11, non-web software, is relevant for a mobile app alongside the web chapter).

Legal nuance: the European Accessibility Act applies to products and services offered to consumers on the market. As long as the app is only for the author's own household, it falls outside that scope. But Play Store distribution is on the table (see 8), and then the requirements do apply. The standard is therefore followed from the start — retrofitting accessibility costs a multiple. (Not legal advice.)

As of 2026, EN 301 549 v3.2.1 is the version in force, which adopts WCAG 2.1 AA; v4 incorporating WCAG 2.2 is expected during 2026. Hence targeting 2.2 AA now.

**Concrete consequences for this design**

- **Meaning is never carried by colour alone.** This affects both the member colour and the item colour from 7.3 directly: each must always be paired with text, an initial or an icon. Without that, the colour is decoration for one user and invisible to another.
- Contrast: 4.5:1 for text, 3:1 for UI components and graphical elements. Applies in dark mode too.
- Touch targets: WCAG 2.2 requires at least 24×24; we hold to 44×44 (7.5).
- Visible focus, and focus must not be obscured by overlays.
- Scalable text — respect the system font size setting, including in the Capacitor build.
- An alternative to dragging: if items can be dragged (moved in the calendar, reordered), there must always be a non-dragging route.
- Sign-in without a cognitive test: no puzzles or memory challenges, and pasting a password must work.
- Screen reader: meaningful labels on every interactive element, including the busy block ("busy, 14:00 to 15:30").

### 7.9 Design tokens ⬜
Define colour, spacing, radius and typography as tokens before any components are built.

---

## 8. Non-functional 🟡

### Quality bar ✅
The app is production-grade and must not fall short of existing commercial alternatives. Distribution through the Play Store is a realistic option for later. That is not a detail: it turns several requirements from "nice" into "mandatory".

### Privacy — guiding principle ✅
**Data not intended for a user must never reach that user.** Not in an API response, not in a realtime event, not in a push message, not in a cache, not in a log line.

This is not an aspiration but the touchstone for every design decision. Worked out concretely in:
- 3.2 — per-item visibility, enforced at the data layer
- 3.4 — never domain content in a notification payload
- 6.4 — resynchronisation on loss of access
- 6.8 — no distinction between "not found" and "no access"

### Decide now, not later ✅
These choices are almost free up front and a migration afterwards:

- **All infrastructure in Western Europe.** Supabase region, Edge Functions, hosting and backups. Changing region means migrating data — do this when creating the project, not later.
- **No personal data in logs.** Log identifiers, not titles, names or email addresses. Cleaning up log lines afterwards is not feasible.
- **Account deletion as a real feature.** The Play Store requires apps with account registration to offer a route to delete the account, including from outside the app. Build it as a function, not as a manual database action.
- **Migrations from commit one.** Schema and RLS policies under version control (6.6), so a second environment can be set up without manual work.

### When offering the app to others ⬜
If the app is used beyond the author's own household, this is added:

- Data processing agreement with Supabase and with the hosting provider
- Privacy statement and terms of use
- Data Safety declaration in the Play Store
- Data subject rights: access, export, erasure
- Retention periods: what happens to a board all of whose members have left?
- Accessibility becomes a **requirement** rather than a quality bar (see 7.8)

### Reliability ⬜
- Error reporting in the client, without personal data
- Backup strategy and restore procedure exercised, not assumed
- Separate environments for development and production

### Other ⬜
Performance budgets.

---

## 9. Build session instructions ✅

> This section is written to be handed to a coding assistant as context. It contains rules, not explanations.

### 9.1 Read this first
- The authorisation matrix (4.2) and the privacy principle (8) are binding. Anything that conflicts with them is wrong — even if it works.
- When in doubt about scope: build only what is on the MVP list (2).
- Ask for clarification rather than assuming something about permissions, visibility or the data model.

### 9.2 Code conventions
- TypeScript in `strict` mode. No `any`, no `@ts-ignore` without an inline justification.
- **Composition API with `<script setup>`. Options API is not permitted.**
- Database types are generated (`supabase gen types typescript`), never hand-written.
- No `supabase` calls in components or stores — only in a module's repository layer (6.3).
- A store holds either client state or server data for one domain (6.4).
- Dutch in the UI, English in code, comments, docs and commits.
- No new dependency without raising it explicitly first.

### 9.3 Hard rules
1. **Every query is board-scoped.** Authorisation is always (user, board), never user alone.
2. **Visibility is enforced in the database**, through RLS policies. Filtering in the frontend is not an implementation — it is a bug.
3. **Never put domain content in a notification payload** (3.4).
4. **No personal data in logs** — identifiers yes, titles and email addresses no.
5. **No distinction between "not found" and "no access"** in error messages (6.8).
6. **Meaning is never carried by colour alone** (7.8).
7. **All infrastructure in Western Europe.** Database, functions, hosting and backups.

### 9.4 Working method per task
1. Migration first: schema change and RLS policy in the same migration file.
2. Regenerate types.
3. Repository layer, then composable, then component.
4. Tests alongside the change, not afterwards. Spec file next to the file.
5. Small, complete units. Five small changes beat one large one.

### 9.5 Test strategy

**Frontend: Vitest** ✅
- **Every file and every piece of functionality is tested.** No untested modules.
- Spec files live **in the same folder as the file they test**, not in a separate `tests/` tree. So `itemRepository.ts` next to `itemRepository.spec.ts`.
- Components, composables, stores and repositories all fall under this.
- **Every test follows Arrange, Act, Assert** — in that order, visibly separated within the test. One action per test; if a second Act is needed, it is a second test.

**Database: RLS policy tests** ✅
- **Not optional.** The matrix in 4.2 is the test specification: per role, per action, against the real database with a real token.
- A policy without a test counts as absent.
- This is a different test layer from Vitest — here the database itself is under test, not the client.

**End-to-end**
- Critical paths: registering, creating a board, inviting, creating an item with restricted visibility.
- One explicit test for the busy block: a member without access receives the time slot and possibly the owner, and no content field whatsoever.

### 9.6 Definition of done
A task is done when:
- The code meets 9.2 and 9.3
- Migrations and policies are in the repository and tested
- The relevant rows of the authorisation matrix are covered by tests
- Accessibility has been checked: contrast, focus, touch target, screen reader label
- Both the web build and the Android build run
- No personal data ends up in logs or error messages

### 9.7 Starting point of the build session ✅

The design has been worked out in Claude Design and covers nearly all features. Import it as the first step, before any code is written:

```
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/10c47ab8-a7f9-4bd8-b90c-9d55ca92307e?file=Gezinsorganisatie+App.dc.html

Implement: Gezinsorganisatie App.dc.html
```

Points to watch when turning the design into code:
- The design is the source for **form**, this document for **behaviour and permissions**. Where they conflict, this document wins — and the discrepancy is reported.
- Take design tokens (7.9) from the import result as tokens, not as loose values scattered across components.
- The imported HTML file is a design artefact, not an application structure. Components follow the folder structure in 6.2.
- Accessibility requirements (7.8) apply to generated markup too; check them explicitly rather than assuming the import got it right.

### 9.8 Environments and release process ✅

**Branches**

| Branch | Purpose | Environment |
|---|---|---|
| `feature/*` | A single change, short-lived | None |
| `develop` | Integration and feature testing | Development |
| `main` | Production | Production |

**Flow**
1. Feature branch from `develop`, PR back into `develop`. CI must be green.
2. Merging into `develop` deploys automatically to the development environment.
3. QA happens there: functional testing, accessibility checks, verification against the authorisation matrix.
4. Only after approval, a PR from `develop` into `main`, with code review.
5. Merging into `main` deploys to production.

**Two complete environments**
Development and production each have their own Supabase project — both in Western Europe. This is not optional: RLS policies and migrations must be testable somewhere before they meet real household data.

- Migrations always run on development first.
- A migration already applied to production is never edited; corrections happen in a new migration.
- Firebase Hosting: a separate site or hosting target per environment.
- Android: development build with a distinct `applicationId`, so both versions can sit on one device.

**No production data in development** ✅
The development environment is filled with seed data, never with a copy of production. Production holds real households' data; that does not belong in an environment with looser access. This follows directly from the privacy principle in 8.

**CI per event**

| Event | Action |
|---|---|
| PR into `develop` or `main` | Lint, typecheck, Vitest, build |
| Merge into `develop` | Migrations + deploy to development |
| Merge into `main` | Migrations + deploy to production |

⬜ Add RLS policy tests to CI once the policies exist: against a throwaway Supabase instance, not against development.

### 9.9 Not decided without discussion
- Changing the stack or adding dependencies
- Relaxing or bypassing an RLS policy, including temporarily for debugging
- Extending the data model
- Adding features outside the MVP list
- Using the service key in code invoked by the client

---

## Open questions

1. Sole owner deleting their **account** — delete the board with them, or block until ownership is transferred? (4.5) Board *deletion* by a sole owner is resolved (only when alone; otherwise hand over); account deletion is not yet addressed.
2. Does an outstanding invitation expire? (4.4)
3. User stories and acceptance criteria for items (3.1)
4. Capacitor: auth redirect and environment per build (6.7)
5. Design tokens (7.9)

**Resolved** (kept here for traceability):
- Board-wide items of a departing member — *keep, don't delete*: re-owned to the receiving owner when an owner leaves, or left in place when a member leaves; only private items are erased (4.5).
- RLS policy tests in CI — done: the `rls-policies` pgTAP job in `ci.yml` (9.8).
