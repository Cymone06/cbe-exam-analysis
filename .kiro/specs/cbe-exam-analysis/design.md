# Design — Personal CBE Exam Analysis

## 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 + TypeScript | Type safety, ecosystem |
| Build | Vite 5 | Fast HMR, small bundles |
| Styling | Tailwind CSS v3 | Utility-first, dark mode via `class` strategy |
| Charts | Recharts 2 | Declarative, responsive, accessible |
| Storage | `idb` (IndexedDB wrapper) | Structured offline storage; localStorage fallback |
| PDF export | `window.print()` + print CSS | Zero-dependency, A4 portrait |
| CSV export | hand-rolled (no lib needed) | Simple, no dependency |
| Icons | `lucide-react` | Lightweight, consistent |
| Date handling | Native `Intl` API | No date-fns dependency needed |

---

## 2. Project Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css                  # Tailwind base + print styles
│
├── types/                     # All TypeScript interfaces / enums
│   └── index.ts
│
├── store/                     # IndexedDB persistence layer
│   ├── db.ts                  # idb setup, schema, migrations
│   └── useStore.ts            # React context + reducer (Zustand-like)
│
├── data/
│   └── seed.ts                # Sample learner + 2 exams
│
├── utils/
│   ├── scoring.ts             # Level calc, mastery aggregation
│   ├── export.ts              # CSV + JSON export helpers
│   └── actionPlan.ts          # Auto-generate remedial suggestions
│
├── hooks/
│   └── useLocalStorage.ts
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # Sidebar + topbar shell
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   │
│   ├── ui/                    # Reusable design-system atoms
│   │   ├── Badge.tsx          # Performance level badge
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── Input.tsx
│   │   ├── Tabs.tsx
│   │   └── ProgressBar.tsx
│   │
│   ├── charts/
│   │   ├── TrendLineChart.tsx
│   │   ├── RadarChart.tsx
│   │   ├── SLOHeatmap.tsx
│   │   └── CognitiveLevelChart.tsx
│   │
│   └── report/
│       └── PrintReport.tsx    # Hidden div rendered only on print
│
└── pages/
    ├── Dashboard.tsx
    ├── ExamList.tsx
    ├── ExamEntry.tsx          # Create / edit exam + questions
    ├── ResultEntry.tsx        # Fast marks entry
    ├── Analysis.tsx           # Competency analysis
    ├── GapDiagnosis.tsx
    ├── ActionPlan.tsx
    ├── ProgressComparison.tsx
    ├── Report.tsx
    └── Settings.tsx
```

---

## 3. Data Model (TypeScript)

```typescript
// types/index.ts

export type PerformanceLevel = 'EE' | 'ME' | 'AE' | 'BE';
export type SubLevel = 'EE2'|'EE1'|'ME2'|'ME1'|'AE2'|'AE1'|'BE2'|'BE1';
export type CognitiveLevel = 'Recall' | 'Understanding' | 'Application' | 'Higher-order';
export type ExamType = 'Formative' | 'CAT' | 'Mid-term' | 'End-term';
export type ErrorType =
  | 'Knowledge gap'
  | 'Application error'
  | 'Careless mistake'
  | 'Time pressure'
  | 'Misread question';

export interface LearnerProfile {
  id: string;
  name: string;
  grade: number;       // 1–12
  school: string;
  year: string;        // e.g. "2025"
}

export interface LearningArea {
  id: string;
  name: string;
  colour: string;      // hex, for chart differentiation
}

export interface Strand {
  id: string;
  learningAreaId: string;
  code: string;
  name: string;
  order: number;
}

export interface SubStrand {
  id: string;
  strandId: string;
  code: string;
  name: string;
  order: number;
}

export interface SLO {
  id: string;
  subStrandId: string;
  code: string;        // e.g. "M.S1.SS2.3"
  description: string;
  weight: number;      // default 1 — used in priority score
}

export interface CoreCompetency {
  id: string;
  name: string;
  shortName: string;   // for radar chart label
  colour: string;
}

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  term: 1 | 2 | 3;
  date: string;        // ISO date string
  learningAreaId: string;
  questions: Question[];
}

export interface Question {
  id: string;
  examId: string;
  number: number;
  maxMarks: number;
  sloId: string;
  performanceIndicator: string;
  cognitiveLevel: CognitiveLevel;
  competencyIds: string[];
}

export interface Result {
  id: string;
  examId: string;
  questionId: string;
  marksScored: number;
  errorType?: ErrorType;
  note?: string;
}

export interface ActionPlanItem {
  id: string;
  sloId: string;
  activity: string;
  practiceTask: string;
  targetLevel: PerformanceLevel;
  reviewDate: string;  // ISO date
  completed: boolean;
}

export interface LevelThresholds {
  EE: number;   // lower bound, e.g. 75
  ME: number;   // lower bound, e.g. 50
  AE: number;   // lower bound, e.g. 25
  // BE is 0 to AE-1
}

export interface AppSettings {
  subLevelEnabled: boolean;
  thresholds: LevelThresholds;
  theme: 'light' | 'dark';
}

export interface AppState {
  learner: LearnerProfile | null;
  learningAreas: LearningArea[];
  strands: Strand[];
  subStrands: SubStrand[];
  slos: SLO[];
  competencies: CoreCompetency[];
  exams: Exam[];
  results: Result[];
  actionPlan: ActionPlanItem[];
  settings: AppSettings;
  seedDismissed: boolean;
}
```

---

## 4. State Management

A single `AppContext` backed by `useReducer` exposes the full `AppState`. All mutations go through typed actions (e.g. `ADD_EXAM`, `SAVE_RESULT`, `UPDATE_SETTINGS`). On every state change a `persistState()` side-effect serialises to IndexedDB via `idb`. On app boot, `loadState()` rehydrates from IndexedDB; if the store is empty, seed data is loaded.

```
AppContext
  └── useReducer(appReducer, initialState)
        └── useEffect → persistState(state) → IndexedDB
```

No external state library is needed given the single-user, moderate data volume.

---

## 5. Scoring & Mastery Utilities (`utils/scoring.ts`)

```
getLevel(pct, thresholds) → PerformanceLevel
getSubLevel(pct) → SubLevel
getMasteryForSLO(sloId, exams, results) → { pct, level }
getMasteryForSubStrand(subStrandId, ...) → { pct, level }
getMasteryForStrand(strandId, ...) → { pct, level }
getMasteryForCompetency(competencyId, ...) → { pct, level }
getPriorityScore(slo, mastery) → number   // (1 - mastery) × slo.weight
getTopStrengths(n, ...) → SLO[]
getTopGaps(n, ...) → SLO[]
```

---

## 6. Page-by-Page Layout

### 6.1 App Shell
- **Mobile**: bottom navigation bar (5 icons: Dashboard, Exams, Analysis, Plan, Settings).
- **Desktop**: fixed left sidebar (240 px) + main content area.
- Top bar shows learner name, grade badge, and theme toggle.

### 6.2 Dashboard
```
┌─────────────────────────────────┐
│  Latest Exam Card               │
│  [Title] [Date] [Level badge]   │
│  [Overall %]  [Trend sparkline] │
├─────────────────────────────────┤
│  Learning Area Overview         │
│  [LA card × n]  level + %       │
├─────────────────────────────────┤
│  Trend Line Chart (Recharts)    │
├──────────────┬──────────────────┤
│  Strengths   │  Priority Gaps   │
│  (top 3)     │  (top 3)         │
└──────────────┴──────────────────┘
```

### 6.3 Exam Entry
Two-step form:
1. **Exam details** — title, type, term, date, learning area.
2. **Questions** — dynamic list; add/remove rows; each row: #, max marks, SLO picker, perf. indicator, cognitive level, competencies.

SLO picker is a cascading select: Learning Area → Strand → Sub-strand → SLO, or a flat search.

### 6.4 Result Entry
Single-column scrollable form. Each row:
```
Q1  [____/10]  [Error type ▾]  [Note 📝]   → 80%  ME 🔵
```
Totals bar sticks to bottom of viewport.

### 6.5 Analysis
Tabs: Strands | Heatmap | Radar | Cognitive

- **Strands tab**: accordion tree Strand → Sub-strand → SLO; each node shows ProgressBar + level badge.
- **Heatmap tab**: grid rendered with CSS/SVG; colour-coded cells; tooltips with exact %.
- **Radar tab**: Recharts `RadarChart` with 7 spokes.
- **Cognitive tab**: stacked bar or donut split by cognitive level.

### 6.6 Gap Diagnosis
Filterable table/list:
- Filter by: Learning Area, Error Type, Level (AE/BE).
- Each row: SLO code, description, mastery %, level badge, dominant error, priority score.
- Sort headers clickable.

### 6.7 Action Plan
Card-based layout. Each card:
```
[SLO code] [Level badge]  ✓ Complete
Activity: ...
Practice: ...
Target: ME by [date]
[Edit]  [Delete]
```
Completed cards visually muted.

### 6.8 Progress Comparison
Two dropdowns to select Exam A and Exam B (same learning area). Table of SLOs with three columns: A %, B %, Δ (with ↑/→/↓ icon and colour). Summary banner at top.

### 6.9 Report (Print)
A4 white card (`max-w-[210mm]`) containing all print-specific content. Uses `@media print` to hide the shell and show only this card. Export via `window.print()`.

### 6.10 Settings
Accordion sections:
1. Learner Profile
2. Performance Levels (threshold sliders + sub-level toggle)
3. Curriculum Editor (Learning Areas, Strands, Sub-strands, SLOs — tree with add/edit/delete)
4. Core Competencies
5. Data Management (Export JSON, Import JSON, Export CSV)
6. Theme

---

## 7. Routing

Using React Router v6 with hash routing (no server needed):

```
/              → Dashboard
/exams         → ExamList
/exams/new     → ExamEntry (create)
/exams/:id     → ExamEntry (edit)
/exams/:id/results → ResultEntry
/analysis      → Analysis
/gaps          → GapDiagnosis
/plan          → ActionPlan
/compare       → ProgressComparison
/report        → Report
/settings      → Settings
```

---

## 8. Colour & Design Tokens

```css
/* Performance level colours */
--color-ee: #22c55e;   /* green-500 */
--color-me: #3b82f6;   /* blue-500  */
--color-ae: #f59e0b;   /* amber-500 */
--color-be: #ef4444;   /* red-500   */

/* Backgrounds (light / dark) */
--bg-primary: white / #0f172a
--bg-surface: #f8fafc / #1e293b
--bg-card:    white / #334155
```

Tailwind `darkMode: 'class'` strategy; toggled by adding/removing the `dark` class on `<html>`.

---

## 9. PDF / Print Strategy

A hidden `<div id="print-report">` is rendered at the root level containing `<PrintReport />`. On print trigger:
1. All other DOM elements get `@media print { display: none }`.
2. `#print-report` becomes the full-page content.
3. `window.print()` opens the browser's native print dialog, defaulting to A4 portrait.

This avoids a PDF library dependency and produces near-perfect fidelity.

---

## 10. Accessibility Notes

- All charts have `role="img"` + `aria-label` with a text summary.
- Form inputs have associated `<label>` elements.
- Modal dialogs use `role="dialog"` + `aria-modal="true"` + focus trap.
- Colour alone is never the only differentiator — levels also show text badges.
- Skip-to-main-content link at page top.

---

## 11. Cloud Architecture (v2 revision)

### 11.1 Layering

```
UI pages ──▶ useApp() ──▶ AppContext (reducer, unchanged shape) ──▶ cache db.ts (per-user namespace)
                              │
                              ├─▶ AuthService  (interface) ──▶ SupabaseAuthService
                              └─▶ DataRepository (interface) ──▶ SupabaseDataRepository ──▶ outbox ──▶ supabase-js
```

- **AuthService** (`src/services/auth.ts`): `signUp`, `signIn`, `signOut`, `sendPasswordReset`,
  `updatePassword`, `updateEmail`, `deleteAccount(tokenEmailConfirmed)`, `getSession`,
  `onAuthStateChange`. Deletes run through the `delete-account` Edge Function (service-role key
  held server-side only).
- **DataRepository** (`src/services/dataRepository.ts`): maps domain objects ↔ snake_case rows
  for the 11 tables; exposes `pullAll(userId)`, `upsert(table, rows)`, `softDelete(table, ids)`,
  `subscribe(userId, onChange)`.
- **Supabase client** (`src/lib/supabase.ts`): single module reading `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_PUBLISHABLE_KEY`; a null client (offline/demo mode) is returned when env vars
  are absent so the whole app still runs locally.
- **UI never imports supabase-js directly** — only via the two service interfaces.

### 11.2 Multi-learner state

`AppState` gains `learners: (LearnerProfile & { colour, archivedAt? })[]` and
`activeLearnerId: string | null`. The existing top-level arrays (`learningAreas`, `exams`, …)
remain **the active learner's workspace** so every existing page keeps working untouched.
$LearnerWorkspace rows all carry the implicit `learnerId`; the cache persists
`{ learners, activeLearnerId, workspaces: Record<LearnerId, Workspace> }` under
`account:<user-id>` (or `account:local` for signed-out use), namespaced per user and cleared on
logout. Switching learners swaps the workspace into the reducer via `SWITCH_LEARNER`
(saving the outgoing one first). All derived data (charts, exports, report, grade filter) reads
the workspace — learner scoping is enforced centrally.

### 11.3 Sync: outbox, conflicts, soft deletes

- Every reducer commit is diffed against the previous state per table; additions/updates become
  outbox `upsert` entries, removals become `softDelete` (tombstone) entries stamped with
  `updated_at`. Sleeps in the outbox, survives reloads.
- Flusher: while online, send in order; on failure retry with exponential backoff (1s→2s→…→60s cap).
- Conflict rule: last-write-wins by `updated_at` — remote rows older than the local copy are
  ignored; incoming tombstones (`deleted_at` set) remove rows locally.
- Realtime subscription on all user tables (filtered `user_id = auth.uid()`) applies remote
  changes; polling is the fallback.
- Sync indicator component reflects the outbox/network state; error state offers manual retry.

### 11.4 Migration of legacy local data

On first signed-in session, the store looks for the legacy `cbe-exam-analysis`/`state` document;
if found it offers "Import my existing data into this account": backup JSON is downloaded, rows
keep their stable IDs (retry-safe, idempotent upserts), then become learner #1 with a progress
banner. Seed data becomes "Add sample learner".

### 11.5 Auth routing & CSP

`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/check-email` routes outside the app
shell; `RequireAuth` guards the rest with "returning to <page>" redirection. `index.html` carries
a CSP meta tag built by Vite env expansion (`%VITE_SUPABASE_URL%`), allowing `connect-src` to
self + the Supabase project only.
