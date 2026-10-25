# Tasks — Personal CBE Exam Analysis

## Implementation Order

Tasks are grouped into phases. Each phase must be complete before the next begins. Within a phase, tasks that have no dependency on each other can be done in parallel.

---

## Phase 1 — Project Scaffolding

- [x] **T1.1** Initialise Vite + React + TypeScript project inside the workspace root.
- [x] **T1.2** Install and configure Tailwind CSS v3 (dark mode `class` strategy).
- [x] **T1.3** Install dependencies: `recharts`, `idb`, `lucide-react`, `react-router-dom`.
- [x] **T1.4** Set up `src/index.css` with Tailwind directives and CSS custom properties for level colours and print styles.
- [x] **T1.5** Configure path aliases (`@/` → `src/`) in `vite.config.ts` and `tsconfig.json`.

---

## Phase 2 — Types & Data Layer

- [x] **T2.1** Create `src/types/index.ts` with all TypeScript interfaces and enums as defined in design.md §3.
- [x] **T2.2** Create `src/store/db.ts` — initialise the `idb` database with object stores: `state`.
- [x] **T2.3** Create `src/store/AppContext.tsx` — `AppContext`, `AppProvider`, `appReducer` with typed actions for all CRUD operations.
- [x] **T2.4** Wire `AppProvider` into `main.tsx`; implement `loadState` (rehydrate from IndexedDB on mount) and `persistState` (save on every state change).
- [x] **T2.5** Create `src/data/seed.ts` — one learner (Basic 6, sample school), two exams (Mathematics Term 1, English Language Term 1), a minimal curriculum structure, and realistic results.

---

## Phase 3 — Utilities

- [x] **T3.1** Create `src/utils/scoring.ts`:
  - `getLevel(pct, thresholds)` → PerformanceLevel
  - `getSubLevel(pct)` → SubLevel
  - `getMasteryForSLO(...)`, `getMasteryForSubStrand(...)`, `getMasteryForStrand(...)`
  - `getMasteryForCompetency(...)`
  - `getPriorityScore(slo, mastery)`
  - `getTopStrengths(n, ...)`, `getTopGaps(n, ...)`
- [x] **T3.2** Create `src/utils/export.ts`:
  - `exportJSON(state)` — serialise full state to downloadable JSON
  - `importJSON(file, dispatch)` — parse and restore state
  - `exportCSV(exams, results, slos)` — one row per question-result
- [x] **T3.3** Create `src/utils/actionPlan.ts`:
  - `generateActionPlanItem(slo, mastery)` — returns a default `ActionPlanItem` with suggested activity, practice task, target level, and review date (+14 days)

---

## Phase 4 — UI Atoms & Layout

- [x] **T4.1** Create `src/components/ui/Badge.tsx` — performance level badge (EE/ME/AE/BE + sub-level variant), colour-coded.
- [x] **T4.2** Create `src/components/ui/Button.tsx` — primary, secondary, ghost, danger variants.
- [x] **T4.3** Create `src/components/ui/Card.tsx` — surface card with optional header slot.
- [x] **T4.4** Create `src/components/ui/Modal.tsx` — accessible dialog with focus trap and `aria-modal`.
- [x] **T4.5** Create `src/components/ui/Input.tsx`, `Select.tsx`, `Tabs.tsx`, `ProgressBar.tsx`.
- [x] **T4.6** Create `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`.
  - Mobile: bottom nav bar with 5 icons.
  - Desktop: fixed 240 px sidebar + top bar.
- [x] **T4.7** Set up React Router v6 in `App.tsx` with all routes from design.md §7.

---

## Phase 5 — Dashboard Page

- [x] **T5.1** Create `src/pages/Dashboard.tsx`:
  - Latest exam summary card (REQ-D1).
  - Learning Area overview cards (REQ-D2).
  - Trend line chart (REQ-D3) — Recharts `LineChart`, filterable by learning area.
  - Strengths & Priority Gaps lists (REQ-D4).
  - Seed data onboarding hint (REQ-D5).

---

## Phase 6 — Exam Management Pages

- [x] **T6.1** Create `src/pages/ExamList.tsx` — list of all exams, grouped by term; links to edit/enter results/delete.
- [x] **T6.2** Create `src/pages/ExamEntry.tsx` — two-step form:
  - Step 1: exam metadata (title, type, term, date, learning area).
  - Step 2: question rows with cascading SLO picker; warn if any question has no SLO (REQ-E3).
- [x] **T6.3** Create the cascading SLO picker component (`src/components/SLOPicker.tsx`) with flat search fallback.

---

## Phase 7 — Result Entry Page

- [x] **T7.1** Create `src/pages/ResultEntry.tsx`:
  - Scrollable question list; marks input per question.
  - Real-time % + level badge update per question (REQ-R2).
  - Optional error type selector and note input per question (REQ-R3).
  - Sticky totals bar showing overall % and level (REQ-R4).

---

## Phase 8 — Analysis Page

- [x] **T8.1** Create `src/components/charts/TrendLineChart.tsx` — `LineChart` with multiple series (one per learning area), responsive container, custom tooltip.
- [x] **T8.2** Create `src/components/charts/RadarChart.tsx` — `RadarChart` with 7 competency spokes, accessible `aria-label`.
- [x] **T8.3** Create `src/components/charts/SLOHeatmap.tsx` — grid of coloured cells; SLOs on Y, exams on X; tooltip showing %; keyboard navigable cells.
- [x] **T8.4** Create `src/components/charts/CognitiveLevelChart.tsx` — `BarChart` or `PieChart` showing mastery split by cognitive level.
- [x] **T8.5** Create `src/pages/Analysis.tsx` with four tabs: Strands (accordion), Heatmap, Radar, Cognitive.

---

## Phase 9 — Gap Diagnosis & Action Plan

- [x] **T9.1** Create `src/pages/GapDiagnosis.tsx`:
  - Filterable, sortable list/table of AE/BE SLOs (REQ-G1 – G3).
  - Button to add selected gaps to action plan.
- [x] **T9.2** Create `src/pages/ActionPlan.tsx`:
  - Card-based list of action items.
  - Inline edit (activity, task, target, date).
  - Complete toggle with visual distinction (REQ-AP3 – AP4).
  - Auto-generate button that adds items for all current gap SLOs.

---

## Phase 10 — Progress Comparison

- [x] **T10.1** Create `src/pages/ProgressComparison.tsx`:
  - Exam A / Exam B dropdowns (filtered to same learning area).
  - SLO comparison table with Δ column (↑ / → / ↓ icons, colour-coded).
  - Summary banner (REQ-PC2).

---

## Phase 11 — Report & Print

- [x] **T11.1** Create `src/components/report/PrintReport.tsx` — full A4 layout for print: learner profile, level per strand, strengths, improvements, comments field, next steps. Growth-oriented language (REQ-REP3).
- [x] **T11.2** Add `@media print` rules to `index.css`: hide shell, show `#print-report`, set A4 dimensions.
- [x] **T11.3** Create `src/pages/Report.tsx` — screen preview of report with "Export PDF" button that calls `window.print()`.

---

## Phase 12 — Settings Page

- [x] **T12.1** Create `src/pages/Settings.tsx` with accordion sections:
  - Learner profile edit form.
  - Performance level threshold sliders + sub-level toggle.
  - Curriculum editor (add/edit/delete Learning Areas, Strands, Sub-strands, SLOs).
  - Core competency editor.
  - Data management (Export JSON, Import JSON, Export CSV).
  - Theme toggle.

---

## Phase 13 — Polish & Accessibility

- [x] **T13.1** Add `aria-label` to all Recharts components; add `role="img"` wrappers.
- [x] **T13.2** Verify keyboard navigation through all interactive elements; add focus ring utilities.
- [x] **T13.3** Add skip-to-main-content link at top of `AppShell`.
- [x] **T13.4** Audit all UI copy for growth-oriented language; replace any shame-based phrasing.
- [x] **T13.5** Verify contrast ratios for all text/background combinations in both light and dark modes.
- [x] **T13.6** Add loading skeleton for the initial IndexedDB rehydration delay.
- [x] **T13.7** Smoke-test the app with Vite dev server; fix any TypeScript or runtime errors.
- [x] **T13.8** Verify that seed data renders correctly on first launch (dashboard non-empty).
- [x] **T13.9** Verify PDF print layout fits one A4 page without overflow.
- [x] **T13.10** Verify CSV export format is correct and importable in spreadsheet tools.

---

## Phase 14 — QA Audit & Release Hardening (found in release audit)

- [x] **T14.1** Add inline rename for Learning Areas, Strands, Sub-strands, SLOs and competencies (REQ-C3, REQ-CC2).
- [x] **T14.2** Editable SLO priority weight used by gap ranking (REQ-G2).
- [x] **T14.3** Cascade-safe deletion: deleting LA/strand/sub-strand/SLO/competency warns with affected counts and prunes orphaned questions, results and plan items (REQ-C5).
- [x] **T14.4** Gap Diagnosis grouped by dominant error type → sub-strand (REQ-G1).
- [x] **T14.5** Marks validation: negative, over-max and non-numeric marks block save with inline warnings; max marks ≥ 1 enforced (REQ-R-entry validation).
- [x] **T14.6** Fix crash-prone hooks-after-early-return in ResultEntry; friendly not-found state.
- [x] **T14.7** "Reset to sample data" and "Clear all data" with confirmation modals.
- [x] **T14.8** CSV export uses learning-area names instead of ids.
- [x] **T14.9** PWA: manifest, icons, service worker with offline caching (REQ-NF1); SW registered in production.
- [x] **T14.10** Heatmap cell text contrast fixed for WCAG AA; aria labels for "no data" cells.
- [x] **T14.11** Code-splitting (react/charts chunks) removing the 500 kB bundle warning; portable `@` alias; favicon added.
- [x] **T14.12** ESLint flat config; lint, type-check and test scripts; all lint errors fixed (purity, hooks rules).
- [x] **T14.13** Vitest unit tests: level boundaries 0/24/25/49/50/74/75/100, sub-levels, mastery aggregation, priority ranking, exam comparison (51 tests).
- [x] **T14.14** End-to-end journey test: learner → curriculum → exam → marks (incl. validation) → dashboard → report print.
- [x] **T14.15** README.md with install/run/build/backup/threshold/curriculum docs.

---

## Phase 15 — Suggested release improvements (from final audit)

- [x] **T15.1** SLO delete modal offers "Reassign & delete" to move linked questions/results/plan
      items to another SLO in the same learning area (REQ-C5 full compliance).
- [x] **T15.2** Playwright E2E against the production preview (full journey + reassignment spec);
      `test:e2e` script; both tests green locally.
- [x] **T15.3** Real PDF download via lazy-loaded jsPDF ("Download PDF") alongside print export.
- [x] **T15.4** Term filter on the Progress Comparison page.
- [x] **T15.5** CI workflow (lint → type-check → unit → build → e2e → Lighthouse ≥ 80) and
      `lighthouserc.json` (written; Lighthouse verified in CI only).

## Phase 16 — Supabase auth, cloud sync & multi-learner (v2)

- [x] **T16.1** Env/secrets: `@supabase/supabase-js`, `.env.example`, `.gitignore` for `.env*`,
      client module, AuthService + DataRepository interfaces and Supabase implementations.
- [x] **T16.2** SQL migration `0001_init.sql` (11 tables, RLS enforced, triggers, checks,
      indexes) + RLS cross-user isolation test script + `delete-account` Edge Function.
- [x] **T16.3** Auth UX: signup (strength meter), verify-email screen + resend, login,
      forgot/reset password, idle auto-logout + keep-signed-in option, protected routes with
      return-to-page, logout clears cache with confirmation, account settings (password/email).
- [x] **T16.4** Multi-learner: learners array + activeLearnerId in state & cache, learner
      switcher in header (persisted), My Learners page (add/edit/archive/delete with counts),
      family overview page with grade filter, per-learner scoping across all pages/exports.
- [x] **T16.5** Offline-first sync: outbox with exponential backoff, LWW conflicts, soft-delete
      sync, initial pull after login, Realtime updates, sync status indicator.
- [x] **T16.6** Legacy data migration offer after first login (backup → import as learner 1),
      "Add sample learner" action.
- [x] **T16.7** Export/import per learner + whole account (merge/replace), learner name on
      CSV/PDF/report, bulk-add learners via CSV.
- [x] **T16.8** CSP meta, a11y pass on new screens, no secrets/tokens logged.
- [x] **T16.9** Tests: unit (auth/repository/outbox/conflicts/migration/import/scoping) and E2E
      journey; full suite (lint, type-check, vitest, build, playwright) green at the end.
- [x] **T16.10** README: Supabase setup, env vars, migration, auth URLs, edge function deploy,
      hosting, backup/restore, adding learners; final checklist report.
