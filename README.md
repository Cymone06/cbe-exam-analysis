# CBE Exam Analysis

A fully client-side, **offline-first** web app that lets a learner, parent, or teacher record CBE
exam results and analyse them through the lens of **competency mastery** — strands, sub-strands,
Specific Learning Outcomes (SLOs) and the 7 Ghana CBE core competencies — rather than raw marks alone.

Built for Ghana's Standards-Based / Competency-Based Education (NaCCA) framework, defaulting to
Basic 6 (Grade 6) sample data.

## What the app does

| Area | Features |
|---|---|
| **Dashboard** | Latest exam summary, mastery per learning area, score trend line (filterable), top 3 strengths, top 3 priority gaps |
| **Exams** | Create/edit exams (Formative / CAT / Mid-term / End-term, term 1–3, date, learning area) with questions: max marks, required SLO link, performance indicator, cognitive level, core-competency tags; delete with confirmation |
| **Results** | Single-pass marks entry with real-time %, level badge and per-question colour bar; optional error type (Knowledge gap / Application error / Careless mistake / Time pressure / Misread question) and note; validation for negative / over-max marks |
| **Performance levels** | EE ≥ 75 %, ME ≥ 50 %, AE ≥ 25 %, BE below — thresholds editable in Settings and instantly re-applied to all history; optional 8-point sub-level scale (EE2…BE1) |
| **Analysis** | Mastery per Strand / Sub-strand / SLO accordion, SLO × exam heatmap, core-competency radar, cognitive-level breakdown |
| **Gap diagnosis** | All AE/BE SLOs grouped by dominant error type then sub-strand, ranked by priority score `(1 − mastery) × weight` (weight editable per SLO); filter and sort |
| **Action plan** | Auto-generated remedial activity + practice task + target level + review date (+14 days default) per gap; fully editable; tick-off with strikethrough |
| **Comparison** | Any two exams of the same learning area, side-by-side per SLO with improved/same/declined deltas and a growth-oriented summary banner |
| **Report** | One-page A4 print/PDF report: learner profile, overall level, level per strand, strengths, areas for further growth, comments field, next steps |
| **Data** | IndexedDB cache (localStorage fallback) with optional **Supabase cloud sync** (auth + Row Level Security), JSON backup export/import per learner or whole account (merge or replace), CSV export incl. learner name, "Reset to sample data" and "Clear all data" with confirmations, legacy local-data migration on first login |
| **Settings** | Account (change password, change email, delete account, keep-signed-in, idle auto-logout), Learner profile, thresholds, sub-levels, full curriculum editor (add/rename/delete Learning Areas, Strands, Sub-strands, SLOs with cascade confirmation), competency editor, light/dark theme |
| **Offline / PWA** | Service worker + web manifest — installs to the home screen and loads with no network after first visit |

## Multi-learner, cloud sync & authentication (v2)

- **Multiple learners per account.** "My Learners" manages every learner (add, edit, archive,
  delete with exact impact counts, CSV bulk-add). A learner switcher sits in the header; every
  page, chart, export and printed report is scoped to the active learner. A family/class overview
  compares all learners' latest level per learning area, filterable by grade.
- **Accounts (optional).** The app works fully offline with no account. Connect a Supabase project
  (below) to enable sign-up with email verification, password reset, sessions with automatic token
  refresh, "keep me signed in", and optional idle auto-logout (default 30 min with a 1-minute warning).
- **Offline-first sync.** Every change is written locally first (IndexedDB, one namespace per
  account); an outbox flushes to Supabase when online with exponential-backoff retries;
  conflicts resolve last-write-wins by `updated_at`; deletions sync as soft deletes (`deleted_at`).
  Realtime keeps other devices up to date, and the header shows sync status (Synced / Syncing /
  Offline — changes saved on this device / Sync error with retry).
- **Security.** Row Level Security is enforced on every table (user-owned rows only, provable with
  `supabase/rls_test.sql`), the publishable key only lives in the frontend, and account deletion
  runs through an Edge Function that holds the service-role key server-side.
- **Migration.** On first login the app offers to import data saved locally by the previous
  single-learner version (a JSON backup is downloaded first; the import is retry-safe).

---

## Supabase setup (enables accounts + cloud sync)

### 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (any region close to your users).
2. Under **Project Settings → API** you will find the **Project URL** and **Publishable (anon)
   key**. Use **only the publishable key** in the frontend — never the `service_role` secret.

### 2. Set environment variables

Copy the example file and fill in your values, or set them in your host's dashboard:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ-your-publishable-anon-key
```

`.env*` files are git-ignored. Without these variables the app simply runs in offline mode.

### 3. Run the database migration

```bash
# with the Supabase CLI
supabase link --project-ref YOUR-PROJECT-REF
supabase migrations up
# or paste supabase/migrations/0001_init.sql into Dashboard → SQL Editor and run it
```

This creates the tables, indexes, check constraints, triggers and **Row Level Security policies**
(user-owned rows only). Prove the isolation with two test users:

```bash
supabase db execute --file supabase/rls_test.sql
# or run the script in Dashboard → SQL Editor — it ends with ROLLBACK and prints
# "ALL RLS CHECKS PASSED" when user B cannot touch user A's rows.
```

### 4. Configure auth

- **Authentication → URL Configuration → Site URL**: your app origin (e.g. `https://yourapp.netlify.app`).
- **Add Redirect URL**: `https://yourapp.example/#/reset-password` (the app uses hash routing).
- Enable the **Email** provider. "Confirm email" is on by default and is required for verification flow.
- Email sending uses Supabase's built-in mailer; for production configure a custom SMTP provider
  under **Project Settings → Authentication → SMTP**.

### 5. Realtime

`0001_init.sql` already adds all tables to the `supabase_realtime` publication. Realtime payloads
respect RLS, so subscribers only ever receive their own rows.

### 6. Deploy the delete-account Edge Function (service-role stays server-side)

```bash
supabase functions deploy delete-account
```

The function (source: `supabase/functions/delete-account/index.ts`) verifies the caller's JWT,
double-checks the typed confirmation email, then deletes the user with
`SUPABASE_SERVICE_ROLE_KEY` — which is injected by Supabase at runtime and must never be placed
in the frontend `.env`. The Settings page calls it only after the user types their email.

### 7. Deploy the app (Netlify/Vercel)

- Build command `npm run build`, publish directory `dist/`.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's environment settings.
- SPA fallback is already handled by hash routing.

### 8. Backup and restore

- **Per learner**: Settings → Data Management → "Export this learner (JSON)".
- **Whole account (all learners)**: "Export whole account (all learners)".
- **Import**: pick a backup → the app validates it → choose **Merge** (keeps your current rows,
  updates what the backup contains) or **Replace** (overwrites the active learner's data).
- Cloud data is additionally protected by Supabase's own backups (paid plans) — export standalone
  JSON backups for full independence.

### 9. Adding learners

- **My Learners → Add learner** (name, grade, school, year, colour).
- **Add from CSV**: a header row is optional; required columns `name,grade`; optional `school,year`:

```csv
name,grade,school,year
Ama Mensah,6,Academy Heights,2026
Kofi Boateng,5,,2026
```
- **Add sample learner** creates a copy of the Basic 6 demo data (a fresh learner, no touch to others).

## Install and run

Requirements: Node.js 18+.

```bash
npm install     # install dependencies
npm run dev     # start the dev server → http://localhost:5173
```

## Build

```bash
npm run lint        # ESLint
npm run type-check  # TypeScript strict check
npm run test        # unit + integration tests (Vitest)
npm run build       # tsc + production build into dist/
npm run preview     # serve the production build locally
```

## Back up and restore data

1. Open **Settings → Data Management**.
2. **Export this learner (JSON)** downloads that learner's data; **Export whole account** exports
   every learner.
3. **Import JSON backup** validates the file, then asks **Merge or Replace** — replace overwrites
   the active learner's data, so export first if in doubt.
4. **Export CSV (all results)** produces one row per question/result for spreadsheet tools, with
   the learner's name in the first column.
5. **Reset to sample data** restores the demo learner + two sample exams.
6. **Clear all data** removes everything on this device (with a strong warning).

## Editing thresholds

**Settings → Performance Level Thresholds** — set the lower bound (%) of EE / ME / AE. BE starts at 0.
Saved values apply immediately to every chart and historical result. Tick the sub-level checkbox to
enable the fixed 8-point scale (EE2 88+, EE1 75+, ME2 63+, ME1 50+, AE2 38+, AE1 25+, BE2 13+, BE1 below).

## Editing the curriculum

**Settings → Curriculum Structure**

- Add a learning area (name + colour), or rename/delete existing ones.
- Expand a learning area's strands: add, rename or delete strands.
- Expand a strand to manage sub-strands; expand a sub-strand to manage SLOs
  (description + optional priority weight `w`).
- Deleting anything shared with exams shows a confirmation listing exactly what will cascade
  (SLOs → linked questions and their results; learning areas → strands, sub-strands, SLOs and exams)
  so no orphaned data is left behind.

## Tech stack

Vite · React 18 · TypeScript (strict) · Tailwind CSS 3 · recharts · react-router 6 (hash routing) ·
idb (IndexedDB) · @supabase/supabase-js (optional cloud) · lucide-react icons. Tests: Vitest +
Testing Library (+ fake-indexeddb), Playwright E2E, Lighthouse CI.

## Project structure

```
src/
  auth/           AuthProvider + route guard (session, idle logout, keep-signed-in)
  components/     ui atoms, charts, layout shell, learners (switcher, sync indicator), print report
  data/seed.ts    sample learner + 2 exams + full curriculum
  lib/            the single Supabase client module (env-driven)
  pages/          Dashboard, MyLearners, Overview, ExamList/Entry, ResultEntry, Analysis,
                  GapDiagnosis, ActionPlan, ProgressComparison, Report, Settings, auth screens
  services/       AuthService · DataRepository · sync engine · workspace diff · legacy migration
  store/          AppContext (multi-learner reducer + cache) · SyncManager · db cache
  test/           setup + unit/e2e journey tests
  types/          domain model
  utils/          scoring, action plan templates, export/import
supabase/
  migrations/0001_init.sql   schema + RLS
  rls_test.sql               cross-user isolation proof
  functions/delete-account   Edge Function (service-role, server-side only)
```
