# Implementation status

**What this file is.** `spec.md` is the *specification* — what the app should
be. This file is the *status* — what is actually built right now. When the two
disagree, that is a discrepancy to surface, not to silently resolve
(CLAUDE.md hard rules).

**For an agent picking up this repo:** read `spec.md` for intended behaviour and
permissions, then read this file to know what exists, what is enforced only in
the database, and what is deferred. Keep it current: when a feature lands or a
gap closes, update the relevant row in the same change.

**Legend**

- ✅ done · 🟡 partial · ❌ not built · ⛔ intentionally out of scope (see roadmap)
- **UI** = a user can do it in the app · **DB/RLS** = the database enforces it
  (the real security boundary, hard rule 2) · **Tests** = covered by Vitest,
  Playwright e2e, or pgTAP.

---

## MVP scope (spec §2)

The MVP is "authorisation and structure", concretely these six items — all
**shipped**:

1. Account — register & sign in ✅
2. Create boards ✅
3. Boards overview / switch ✅
4. Invite members by email ✅
5. Create items (visibility, optional date, colour) ✅
6. Data synchronisation (lifecycle fetch + sync button) ✅

Explicitly **out of MVP** (deferred — see roadmap): realtime board updates,
push/local notifications, grocery-style lists as their own entity, recurring
items, external-calendar integration. Explicitly **never**: fairness scores /
points / streaks / leaderboards, local-first offline editing.

---

## Feature status

### Accounts & session
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Register (sign-up) | ✅ | ✅ | ✅ | profile row auto-created by `handle_new_user` |
| Sign in / out | ✅ | ✅ | ✅ | |
| Delete account | ✅ | ✅ | ✅ | `delete_current_user(handovers)`; solo boards auto-deleted, solely-owned shared boards prompt for a successor (spec 4.5) |

### Boards
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Create board (name + accent) | ✅ | ✅ | ✅ | via `create_board` RPC |
| Overview / open / switch | ✅ | ✅ | ✅ | |
| Change board settings (rename, accent, default visibility) | ✅ | ✅ | ✅ | owner-only settings screen (gear in the board header) |
| Delete board | ✅ | ✅ | ✅ | owner-only, and only when sole member; otherwise leave & hand over (spec 4.5) |

### Members & roles (spec §4.2)
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Roles owner / member / guest | ✅ | ✅ | ✅ | role attaches to membership, per (user, board) |
| Change a member's role | ✅ | ✅ | ✅ | owner-only, gated by `isOwner` |
| Remove a member | ✅ | ✅ | ✅ | owner-only; removed member's private items deleted, the rest stays |
| Leave a board (remove self) | ✅ | ✅ | ✅ | owner hands items to a chosen owner; a member keeps board items, loses private (spec 4.5) |

### Groups
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Create / rename / delete group | ✅ | ✅ | ✅ | owner-only |
| Set group members | ✅ | ✅ | ✅ | used as a `shared_with` audience |

### Invitations
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Invite by email (with role) | ✅ | ✅ | ✅ | owner-only, `create_invitation` |
| Withdraw a pending invite | ✅ | ✅ | ✅ | |
| Accept / decline my invites | ✅ | ✅ | ✅ | `accept_invitation` |
| Invite via shareable link/code | ❌ | ❌ | — | shown in the design, **not** in the spec — out of scope |

### Items
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Quick capture (title only) | ✅ | ✅ | ✅ | inline "+ details": date, assignee, colour, visibility |
| Full create / edit / delete | ✅ | ✅ | ✅ | |
| Toggle done | ✅ | ✅ | ✅ | |
| Visibility board / private / shared_with | ✅ | ✅ | ✅ | enforced by RLS |
| Colour, assignee, date/time, notes | ✅ | ✅ | ✅ | |
| Busy blocks (others' private dated items) | ✅ | ✅ | ✅ | content-free projection, spec §3.2 |
| Assign to another member | ✅ | ✅ | ✅ | a guest's assignee picker is limited to themselves; others' items open read-only |

### Board views & shell
| Capability | UI | Tests | Notes |
|---|:--:|:--:|---|
| Kalender (month calendar + day sheet) | ✅ | ✅ | |
| To-do's (dateless items) | ✅ | ✅ | |
| Lijst (all items, newest first) | ✅ | ✅ | |
| Light / dark theme | ✅ | ✅ | toggle on the boards overview |
| Accessibility (touch targets, focus, meaning ≠ colour, iOS tap fix) | ✅ | ✅ | |
| Dutch UI, English code | ✅ | — | |

### Authorisation matrix (spec §4.2) — enforcement summary
Every row is enforced in the DB and covered by pgTAP, and every row is now also
reflected in the UI. Owner-only screens are hidden behind `isOwner`; a guest's
item controls are gated up front — the assignee picker offers only themselves,
and an item they may not edit opens **read-only** rather than failing on save.

---

## Enforcement model (why UI and DB columns differ)

Authorisation is **database-first**: RLS policies and guard triggers are the
source of truth (hard rule 2). The DB always has the final say. The UI mirrors
it up front so a user rarely hits a rejection: owner-only screens are hidden
(via `isOwner`), a guest's assignee picker is limited to themselves, and an item
a guest may not edit opens read-only. The DB checks remain the real boundary —
the UI gating is convenience, not the guarantee.

---

## Infrastructure & delivery

| Area | Status | Notes |
|---|:--:|---|
| CI: lint · typecheck · unit+coverage · build | ✅ | `ci.yml` → `verify` job |
| CI: Playwright e2e (offline, mocked backend) | ✅ | `ci.yml` → `e2e` job, uploads screenshots |
| CI: RLS pgTAP suite | ✅ | `ci.yml` → `rls-policies` job |
| Deploy: develop → development (migrations + Firebase) | ✅ | live at the dev site |
| Deploy: main → production | 🟡 | workflow + Firebase targets ready; **prod Supabase/Firebase env not provisioned** (see SETUP.md §6) |
| `src/shared/types/database.ts` | 🟡 | hand-authored mirror; regenerate with `npm run db:types` where Docker is available, then commit |
| Android (Capacitor) build | ❌ | `capacitor.config.ts` set; native project not generated/tested yet |

---

## Roadmap — next iterations

Ordered by value for finishing the product.

- ~~Board settings + delete UI~~ — **done**: owner-only settings screen, plus
  board deletion, leaving and item handover (spec 4.5).
- ~~Guest/member UI gating~~ — **done**: a guest's assignee picker is limited to
  themselves, and items they may not edit open read-only.
- ~~Account deletion when sole owner~~ — **done**: prompt-to-pick a successor —
  solo boards auto-delete, solely-owned shared boards hand over to a nominated
  member (spec 4.5).

1. **Android build & Play-Store path** — generate the Capacitor project, verify
   the Android build, distinct dev/prod `applicationId`.
2. **Type generation** — regenerate `database.ts` from the live schema; consider
   a CI drift-check so it can't fall behind.
3. **Production go-live** — provision the production Supabase + Firebase, then a
   gated first release (SETUP.md §6 checklist).

Then the spec's "Later / out of scope" backlog:

6. Realtime board updates (spec §3.3).
7. Push / local notifications via FCM (spec §3.4) — neutral payloads only
   (hard rule 3).
8. Grocery-style **lists** as their own entity type.
9. Recurring items (spec §3.5.2).
10. External-calendar integration.

Open spec sections to revisit as part of the above: §6.7 Capacitor specifics,
§7.9 final design tokens, §8 reliability and "offering the app to others".
