# Requirements — Personal CBE Exam Analysis

## Overview

A fully client-side, offline-first web application that lets a learner, parent, or teacher record CBE exam results and analyse them through the lens of competency mastery — strands, sub-strands, SLOs, and core competencies — rather than raw marks alone.

---

## 1. Functional Requirements

### 1.1 Learner Profile

- **REQ-L1** The user shall be able to create and edit a learner profile containing: full name, grade (1–12), school name, and academic year.
- **REQ-L2** The app shall support a single active learner profile (single-user, no auth).
- **REQ-L3** Profile data shall persist in localStorage/IndexedDB and survive page refresh.

### 1.2 Curriculum Structure

- **REQ-C1** The user shall be able to define Learning Areas (e.g. Mathematics, English, Integrated Science).
- **REQ-C2** Within each Learning Area, the user shall be able to define a three-level hierarchy: **Strand → Sub-strand → Specific Learning Outcome (SLO)**.
- **REQ-C3** The user shall be able to add, edit, and delete Strands, Sub-strands, and SLOs at any time.
- **REQ-C4** Each SLO shall carry a short code (e.g. `M.S1.SS2.3`) and a description.
- **REQ-C5** Deletion of a Strand/Sub-strand/SLO that is referenced by existing questions shall prompt a warning and offer reassignment or cascade-delete.

### 1.3 Core Competencies

- **REQ-CC1** The system shall ship with the 7 Ghana CBE core competencies as defaults: *Critical Thinking & Problem Solving, Creativity & Innovation, Communication & Collaboration, Digital Literacy, Personal Development & Leadership, Global Citizenship, Cultural Identity & Expression*.
- **REQ-CC2** The user shall be able to rename, add, or delete core competency tags in Settings.

### 1.4 Exam Management

- **REQ-E1** The user shall be able to create an exam with: title, type (Formative | CAT | Mid-term | End-term), term (1 | 2 | 3), date, and learning area.
- **REQ-E2** The user shall be able to add questions/tasks to an exam, each with: question number, max marks, linked SLO (required), performance indicator text, cognitive level (Recall | Understanding | Application | Higher-order), and one or more core competency tags.
- **REQ-E3** Every question must be linked to an SLO; the app shall display a warning banner and prevent saving the exam if any question has no SLO assigned.
- **REQ-E4** The user shall be able to edit or delete existing exams and questions.
- **REQ-E5** Deleting an exam shall require a confirmation dialog.

### 1.5 Result Entry

- **REQ-R1** The marks entry UI shall display all questions in a scrollable list; the user enters marks scored for each question in a single pass.
- **REQ-R2** As marks are entered, the app shall instantly compute and display: percentage score, performance level (EE/ME/AE/BE + optional sub-level), and colour indicator per question.
- **REQ-R3** For each question, the user may optionally select an error type (Knowledge gap | Application error | Careless mistake | Time pressure | Misread question) and add a free-text note.
- **REQ-R4** The overall exam total, percentage, and performance level shall update in real time as marks are entered.

### 1.6 Performance Levels

- **REQ-P1** Default thresholds: EE 75–100 %, ME 50–74 %, AE 25–49 %, BE 0–24 %.
- **REQ-P2** The user shall be able to edit thresholds in Settings; changes shall immediately re-calculate all historical results.
- **REQ-P3** Optionally, the user shall be able to enable an 8-point sub-level scale: EE2 (88–100 %), EE1 (75–87 %), ME2 (63–74 %), ME1 (50–62 %), AE2 (38–49 %), AE1 (25–37 %), BE2 (13–24 %), BE1 (0–12 %).
- **REQ-P4** Colour coding: EE → green (`#22c55e`), ME → blue (`#3b82f6`), AE → amber (`#f59e0b`), BE → red (`#ef4444`).

### 1.7 Dashboard

- **REQ-D1** The dashboard shall show a summary card for the most recent exam: title, date, overall percentage, and level badge.
- **REQ-D2** The dashboard shall show the current overall performance level per Learning Area (aggregate across all exams).
- **REQ-D3** A trend line chart shall display the learner's exam scores over time, filterable by learning area.
- **REQ-D4** The dashboard shall list the top 3 strengths (highest-mastery SLOs) and top 3 priority gaps (lowest-mastery SLOs with AE/BE rating).
- **REQ-D5** When no data exists beyond seed data, the dashboard shall display the seed data and a short onboarding hint.

### 1.8 CBE Competency Analysis

- **REQ-A1** The app shall compute and display mastery % and level per Strand, Sub-strand, and SLO across all exams in a selected learning area.
- **REQ-A2** A heatmap shall show SLOs on the Y-axis and exams on the X-axis, colour-coded by performance level, revealing progress over time.
- **REQ-A3** A radar chart shall show average mastery % for each of the 7 core competencies.
- **REQ-A4** A bar/donut chart shall break down questions by cognitive level (Recall, Understanding, Application, Higher-order) and the learner's mastery within each level.

### 1.9 Gap Diagnosis

- **REQ-G1** The gap list shall show all SLOs where mastery is AE or BE, grouped first by error type then by sub-strand.
- **REQ-G2** Each gap item shall show: SLO code, description, mastery %, level badge, dominant error type, and a priority score (calculated as `(1 - mastery) × SLO weight`, where weight defaults to 1 but can be set per SLO).
- **REQ-G3** The list shall be sortable by priority score, mastery %, or learning area.

### 1.10 Action Plan

- **REQ-AP1** For each gap SLO, the system shall auto-generate a suggested remedial activity, a practice task description, a target performance level, and a suggested review date (default: +2 weeks).
- **REQ-AP2** The user shall be able to edit any field of an action plan item.
- **REQ-AP3** The user shall be able to mark action plan items as complete (tick off).
- **REQ-AP4** Completed items shall be visually distinguished but remain visible (strikethrough + muted).

### 1.11 Progress Comparison

- **REQ-PC1** The user shall be able to select any two exams (of the same learning area) and see a side-by-side comparison per SLO showing: score exam A, score exam B, and a delta indicator (improved ↑, same →, declined ↓).
- **REQ-PC2** A summary banner shall show the overall change (percentage points difference) and a growth-oriented label.

### 1.12 CBE Report

- **REQ-REP1** A printable one-page report shall include: learner profile, date, learning area, overall level, level per strand, top 3 strengths, top 3 areas for improvement, teacher/parent comments text field, and next steps.
- **REQ-REP2** The user shall be able to export the report as a PDF (A4, portrait) using `window.print()` or a library such as `jsPDF`.
- **REQ-REP3** Language shall be growth-oriented throughout (e.g. "Approaching Expectations — the next step is…").

### 1.13 Data Management

- **REQ-DM1** All data shall be stored in IndexedDB (primary) with localStorage as fallback, using the `idb` npm package.
- **REQ-DM2** The user shall be able to export all data as a JSON backup file.
- **REQ-DM3** The user shall be able to import a JSON backup file, with a warning that import will overwrite current data.
- **REQ-DM4** The user shall be able to export exam results as a CSV file (one row per question-result).
- **REQ-DM5** The user shall be able to export the CBE report as PDF.

### 1.14 Settings

- **REQ-S1** Settings page shall expose: learner profile edit, performance level thresholds, sub-level scale toggle, curriculum structure editor, core competency editor, theme toggle (light/dark).
- **REQ-S2** Theme preference shall persist in localStorage.

### 1.15 Seed Data

- **REQ-SD1** On first launch, the app shall pre-load one learner profile and two exams (different terms) covering at least two learning areas so the dashboard is non-empty.
- **REQ-SD2** Seed data shall be clearly labelled "Sample data" and dismissible.

---

## 2. Non-Functional Requirements

- **REQ-NF1 Offline-first**: the app shall function completely without network access after first load. No external API calls at runtime.
- **REQ-NF2 Performance**: initial load < 3 s on a mid-range mobile device (Lighthouse score ≥ 80).
- **REQ-NF3 Responsiveness**: layouts shall adapt gracefully from 320 px (mobile) to 1440 px (desktop); mobile-first breakpoints.
- **REQ-NF4 Accessibility**: WCAG 2.1 AA target — keyboard navigation, focus indicators, ARIA labels on interactive charts, minimum 4.5:1 contrast ratio.
- **REQ-NF5 Tone**: all UI copy shall use growth-oriented, encouraging language; no shame-based or punitive wording.
- **REQ-NF6 Browser support**: latest two versions of Chrome, Firefox, Safari, and Edge.

---

## 3. Clarifying Assumptions (pending user confirmation)

> **Please confirm or correct these before implementation proceeds:**

| # | Assumption | Default chosen |
|---|-----------|----------------|
| A1 | **Grade level / curriculum** — seed data and default strands are based on Ghana's NaCCA CBE curriculum for **Basic 6 (Grade 6)** | ✅ Confirmed |
| A2 | **Default learning areas in seed data** — Mathematics, English Language, Integrated Science | ✅ Confirmed |
| A3 | **Terms** — three terms per year (Term 1, 2, 3) | ✅ Confirmed |
| A4 | **Single learner** — no multi-learner support in v1 | ✅ Confirmed |
| A5 | **PDF export** — uses browser `window.print()` with a print-specific CSS stylesheet (no heavy PDF library) | ✅ Confirmed |
| A6 | **CSV export** — one CSV file containing all exams, one row per question-result | ✅ Confirmed |
| A7 | **Language** — UI language is English only | ✅ Confirmed |

---

## 4. Cloud, Authentication & Multi-Learner (v2 revision)

> **Revision note (v2):** assumptions A4 (single learner) and the local-only stance of REQ-NF1 are
> superseded by this section. The app remains fully functional offline — Supabase adds
> authentication, cloud persistence and multi-learner support on top of the local cache.

### 4.1 Accounts & authentication

- **REQ-A1** Users sign up with display name, email and password (min 8 chars, with a strength
  indicator and show/hide toggle). Email verification is required before first use; a friendly
  "Check your email" screen with a resend button is shown.
- **REQ-A2** Users can log in, log out (header + mobile menu), and recover a forgotten password
  via an email reset link. A `/reset-password` route handles the recovery link.
- **REQ-A3** Sessions use Supabase's persisted session with automatic token refresh. A
  "Keep me signed in on this device" option controls persistence; optional idle auto-logout
  (configurable, default 30 min, with a 1-minute warning) is available.
- **REQ-A4** All routes are protected. Unauthenticated users are redirected to login and returned
  to the page they requested after signing in. Expired sessions are handled gracefully.
- **REQ-A5** Login/signup errors are generic and never reveal whether an email is registered;
  rate limiting relies on Supabase, with friendly messages when rate-limited.
- **REQ-A6** Settings offers change password, change email and delete account. Deletion runs
  through a Supabase Edge Function that holds the service-role key **server-side only**, after
  the user confirms by typing their email. The function code + deployment steps live in the README.
- **REQ-A7** On logout, in-memory state and that account's local offline cache are cleared, and a
  "Signed out" confirmation is shown.

### 4.2 Secrets & architecture

- **REQ-S1** `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` come from env vars; `.env.example`
  documents placeholders; `.env*` is git-ignored; no real keys in code; **no service-role or secret
  key anywhere in frontend code**.
- **REQ-S2** Auth and storage sit behind `AuthService` / `DataRepository` interfaces with a Supabase
  implementation — the UI never calls Supabase directly.

### 4.3 Database & Row Level Security

- **REQ-DB1** A SQL migration (`supabase/migrations/0001_init.sql`) creates tables: profiles,
  learners, learning_areas, strands, sub_strands, slos, exams, questions, results,
  action_plan_items, user_settings — each with `id uuid pk`, `user_id uuid not null default
  auth.uid() → auth.users(id) on delete cascade`, `created_at`, `updated_at` (trigger-maintained),
  `deleted_at` (soft delete).
- **REQ-DB2** Learner-owned tables also carry `learner_id → learners(id) on delete cascade`;
  FKs and indexes exist on `user_id`, `learner_id` and every FK column; check constraints cover
  marks ≥ 0, max_marks ≥ 1 and valid enum values.
- **REQ-DB3** RLS is enabled AND forced on every table, with select/insert/update/delete policies
  for authenticated users where `(select auth.uid()) = user_id`, WITH CHECK on writes; a safeguard
  prevents child rows pointing to parents owned by a different user; a trigger creates the profile
  row on signup. No table or view is exposed without RLS. A documented SQL test proves user A
  cannot touch user B's rows.

### 4.4 Multiple learners

- **REQ-ML1** An account holds unlimited learners (name, grade, school, year, colour/initials).
- **REQ-ML2** "My Learners" page: cards with latest level summary, exam count, last activity;
  add / edit / archive / delete (delete confirms exact counts of exams, results & plan items).
- **REQ-ML3** A learner switcher in the header is always visible; the active learner persists
  across refreshes; the active learner's name appears on every page and the printed report.
- **REQ-ML4** Every query, chart, export and report is scoped to the active learner — no data may
  leak between learners.
- **REQ-ML5** A "Family or class overview" table shows all learners' latest level per learning
  area, filterable by grade; clicking a learner switches to them.
- **REQ-ML6** Each learner has their own curriculum, with "copy curriculum from another learner"
  and "use a template by grade"; bulk-add learners from CSV is provided.

### 4.5 Offline-first sync

- **REQ-SY1** IndexedDB stays the local cache; reads/writes happen locally first so the app works
  offline. An outbox queue syncs pending changes automatically when online, with retries and
  exponential backoff.
- **REQ-SY2** Conflicts resolve last-write-wins by `updated_at`; deletions sync via `deleted_at`.
- **REQ-SY3** After login an initial pull loads the user's data; Supabase Realtime (or polling)
  streams changes from other devices; a sync indicator shows Synced / Syncing / Offline — changes
  saved on this device / Sync error (retry). Data is never silently lost; the cache is namespaced
  per user and cleared on logout.

### 4.6 Migration, export & import

- **REQ-MG1** On first login the app detects existing local single-learner data and offers
  "Import my existing data into this account": automatic JSON backup first, safe to retry,
  duplicate-free via stable IDs; existing data becomes the first learner with progress feedback.
  Seed data becomes an optional "Add sample learner" action.
- **REQ-EX1** JSON export per learner or whole account; import validates schema and asks merge
  or replace. CSV, PDF and the A4 report include the learner's name.
- **REQ-UX1** CSP meta tag allowing connections to the Supabase project URL only; no tokens,
  passwords or full user objects logged; labelled forms, inline validation, `aria-describedby`
  errors, focus on first error, visible focus, keyboard-accessible switcher/menus; responsive at
  360/768/1280; friendly loading/empty/error states.
- **REQ-T1** Unit tests cover AuthService/DataRepository (mocked client), learner scoping, outbox
  + retry, conflict resolution, soft-delete sync, migration idempotency, import validation; a
  documented script verifies RLS cross-user isolation; an E2E journey covers signup → verify →
  two learners → exams → switching → offline edit → online sync → logout/login.
