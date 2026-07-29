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
| Delete account | ✅ | ✅ | ✅ | `delete_current_user` SECURITY DEFINER |

### Boards
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Create board (name + accent) | ✅ | ✅ | ✅ | via `create_board` RPC |
| Overview / open / switch | ✅ | ✅ | ✅ | |
| Change board settings (rename, accent, default visibility) | ✅ | ✅ | ✅ | owner-only settings screen (gear in the board header) |
| Delete board | ✅ | ✅ | ✅ | owner-only, in the settings screen's danger zone |

### Members & roles (spec §4.2)
| Capability | UI | DB/RLS | Tests | Notes |
|---|:--:|:--:|:--:|---|
| Roles owner / member / guest | ✅ | ✅ | ✅ | role attaches to membership, per (user, board) |
| Change a member's role | ✅ | ✅ | ✅ | owner-only, gated by `isOwner` |
| Remove a member | ✅ | ✅ | ✅ | owner-only |
| Leave a board (remove self) | ✅ | ✅ | ✅ | last-owner guard keeps ≥1 owner |

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
| Assign to another member | 🟡 | ✅ | ✅ | picker shown to everyone; a **guest** is denied at the DB (not greyed out) |

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
Every row is enforced in the DB and covered by pgTAP. The one cell **not**
reflected in the UI:

- **Assign to another member (guest denial)** — enforced by the DB guard, not
  pre-empted in the UI.

Everything else (change settings, delete board, invite, remove, change roles,
manage groups, per-role visibility, create/edit/delete items) is both
UI-exposed and DB-enforced.

---

## Enforcement model (why UI and DB columns differ)

Authorisation is **database-first**: RLS policies and guard triggers are the
source of truth (hard rule 2). The UI *hides* owner-only screens (via `isOwner`)
but does **not** proactively disable every guest/member restriction — e.g. a
guest sees the assignee picker and the database rejects the assignment on
submit. That is "correctly denied", but the denial can surface as an error
rather than a greyed-out control. Closing that gap is UX polish, not a security
fix (see roadmap).

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

- ~~Board settings + delete UI~~ — **done**: owner-only settings screen (rename,
  accent, default visibility) and a delete-board action.

1. **Guest/member UI gating** — disable disallowed controls up front instead of
   relying on a DB rejection on submit.
2. **Android build & Play-Store path** — generate the Capacitor project, verify
   the Android build, distinct dev/prod `applicationId`.
3. **Type generation** — regenerate `database.ts` from the live schema; consider
   a CI drift-check so it can't fall behind.
4. **Production go-live** — provision the production Supabase + Firebase, then a
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
