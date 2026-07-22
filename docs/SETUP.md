# Setup and infrastructure

The repository, documentation and design are in place. The backend services are
**not** — Supabase, Firebase and the CI secrets still need to be created. This
document lists exactly what to provision and which values to fill in. Nothing
here contains secrets; it says where they go.

Everything lives in **Western Europe** (spec hard rule 7 / 8): choose an EU
region for every Supabase project, Firebase Hosting site and any Edge Function.

## 1. Local development

```bash
npm install
cp .env.example .env.local        # fill in the two Supabase values
npx supabase start                # local Postgres + Auth + RLS (needs Docker)
npm run db:types                  # regenerate src/shared/types/database.ts
npm run dev
```

> The committed `src/shared/types/database.ts` was authored by hand to mirror
> the initial migration, because the build sandbox could not run Docker. It is
> marked "regenerate, do not hand-edit". Run `npm run db:types` against the
> local stack (or CI's throwaway instance) and commit the generated result — the
> diff should be tiny.

## 2. Supabase — two projects

Development and production each get their own Supabase project, both in the EU
(spec 9.8). Migrations always run on development first.

For each project:

1. Create the project (EU region).
2. Apply migrations: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`.
3. Collect the five values the CI needs (see the mapping table below).

### Where each value lives in the dashboard

Supabase's dashboard labels move around; treat the live UI as authoritative and
use this as a guide. The names in the left column are *our* GitHub var/secret
names (section 4) — they are just labels and do not need to match Supabase's
wording.

| Our name | What it is | Roughly where in Supabase |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Project Settings → Data API → Project URL |
| `SUPABASE_PROJECT_REF` | project reference id | Project Settings → General → Reference ID (also the URL's subdomain) |
| `SUPABASE_ANON_KEY` | the public, client-safe key | Project Settings → API Keys → **Publishable key** (see the note below) |
| `SUPABASE_DB_PASSWORD` | database password | set when the project is created; reset under Project Settings → Database |
| `SUPABASE_ACCESS_TOKEN` | CLI personal access token | **Account** level, not the project: <https://supabase.com/dashboard/account/tokens> |

### Note on API keys — new vs legacy

Supabase has replaced its original API keys with a new key system, so a fresh
project shows both:

- **Publishable key** (`sb_publishable_…`) — the public, client-safe key. **Use
  this for `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`.**
- **Secret key** (`sb_secret_…`) — the privileged key. Never used here.
- The original **anon** and **service_role** keys (long `eyJ…` JWTs) now sit
  under a **Legacy API keys** tab and are being phased out.

The legacy **anon** key still works and is interchangeable with the publishable
key (`supabase-js` accepts either, and both map to the `anon` PostgREST role),
but prefer the publishable key on a new project. Despite the GitHub secret being
named `SUPABASE_ANON_KEY`, put the **publishable** key in it — "anon" here just
means "the public client key", not specifically the legacy tab.

The **secret key / legacy service_role key is never used in client code or in
any workflow a fork can trigger** (hard rule 7). Neither is referenced anywhere
in this repo.

## 3. Firebase Hosting — one project, two targets

1. Create a Firebase project (or reuse one) and two Hosting sites, e.g.
   `huishouden-dev` and `huishouden-prod`.
2. Replace the placeholders in `.firebaserc` with the real project id and site
   names.
3. Create a service account with the *Firebase Hosting Admin* role and download
   its JSON key — this becomes `FIREBASE_SERVICE_ACCOUNT` below.

## 4. GitHub Actions — variables and secrets

The three workflows in `.github/workflows/` are complete in structure; they read
their environment-specific values from GitHub. Set these per **environment**
(`development` and `production`, under *Settings → Environments*):

### Variables (`vars.*`)

| Name | Used by | Value |
|---|---|---|
| `SUPABASE_PROJECT_REF` | deploy-\* | Supabase project ref for that environment |
| `SUPABASE_URL` | deploy-\* | `https://<ref>.supabase.co` |
| `FIREBASE_PROJECT_ID` | deploy-\* | Firebase project id |

### Secrets (`secrets.*`)

| Name | Used by | Value |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | deploy-\* | Personal access token for the Supabase CLI |
| `SUPABASE_DB_PASSWORD` | deploy-\* | Database password for that project |
| `SUPABASE_ANON_KEY` | deploy-\* | Public client key — the **publishable key** (`sb_publishable_…`); the legacy anon key also works (see §2) |
| `FIREBASE_SERVICE_ACCOUNT` | deploy-\* | Contents of the Hosting service-account JSON |

Attach a **required reviewer** to the `production` environment so a merge into
`main` cannot reach production unnoticed (already assumed by
`deploy-production.yml`).

### CI flow (spec 9.8)

| Event | Workflow | Action |
|---|---|---|
| PR into `develop`/`main` | `ci.yml` | lint, typecheck, test + coverage, build |
| Merge into `develop` | `deploy-development.yml` | migrations + deploy to development |
| Merge into `main` | `deploy-production.yml` | migrations + deploy to production |

The RLS policy tests (spec 9.8, still ⬜) run against a throwaway Supabase
instance once written — the placeholder job is commented in `ci.yml`.

## 5. Android (Capacitor)

`capacitor.config.ts` is set up (appId `nl.huishouden.app`, `webDir: dist`). The
native platform is generated on demand and is git-ignored:

```bash
npm run build
npx cap add android
npx cap sync android
```

Use a distinct `applicationId` suffix for the development build so it can sit
next to production on one device (spec 9.8).
