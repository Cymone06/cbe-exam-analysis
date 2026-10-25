// ─── Enums / Literals ────────────────────────────────────────────────────────

export type PerformanceLevel = 'EE' | 'ME' | 'AE' | 'BE';

export type SubLevel =
  | 'EE2' | 'EE1'
  | 'ME2' | 'ME1'
  | 'AE2' | 'AE1'
  | 'BE2' | 'BE1';

export type CognitiveLevel =
  | 'Recall'
  | 'Understanding'
  | 'Application'
  | 'Higher-order';

export type ExamType = 'Formative' | 'CAT' | 'Mid-term' | 'End-term';

export type ErrorType =
  | 'Knowledge gap'
  | 'Application error'
  | 'Careless mistake'
  | 'Time pressure'
  | 'Misread question';

// ─── Core domain ─────────────────────────────────────────────────────────────

export interface LearnerProfile {
  id: string;
  name: string;
  grade: number;   // 1–12
  school: string;
  year: string;    // e.g. "2025"
  /** Personal colour for the learner card/avatar (v2 multi-learner). */
  colour?: string;
  /** ISO timestamp when the learner was archived (v2). */
  archivedAt?: string | null;
}

export interface LearningArea {
  id: string;
  name: string;
  colour: string;  // hex
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
  weight: number;      // default 1
}

export interface CoreCompetency {
  id: string;
  name: string;
  shortName: string;
  colour: string;
}

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  term: 1 | 2 | 3;
  date: string;          // ISO date
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

// ─── Settings ────────────────────────────────────────────────────────────────

export interface LevelThresholds {
  EE: number;   // lower bound, e.g. 75
  ME: number;   // lower bound, e.g. 50
  AE: number;   // lower bound, e.g. 25
}

export interface AppSettings {
  subLevelEnabled: boolean;
  thresholds: LevelThresholds;
  theme: 'light' | 'dark';
  /** Idle auto-logoutAfter N minutes (0 disables); default 30 (v2, signed-in only). */
  idleLogoutMinutes?: number;
  /** Keep the session on this device across relaunches (v2). */
  keepSignedIn?: boolean;
}

// ─── App-wide state ───────────────────────────────────────────────────────────

export interface AppState {
  /** Multi-learner (v2): all learners under this account + the active one. */
  learners: LearnerProfile[];
  activeLearnerId: string | null;
  /** Everyone else's data lives in the account cache; these arrays are the
   *  ACTIVE learner's workspace. */
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

// ─── Mastery helpers (returned by scoring utils) ──────────────────────────────

export interface MasteryResult {
  pct: number;
  level: PerformanceLevel;
  subLevel?: SubLevel;
}

// ─── Multi-learner workspace (v2) ─────────────────────────────────────────────

/** The per-learner slice of data. Same tables the v1 reducer held, but scoped. */
export interface LearnerWorkspace {
  learningAreas: LearningArea[];
  strands: Strand[];
  subStrands: SubStrand[];
  slos: SLO[];
  competencies: CoreCompetency[];
  exams: Exam[];
  results: Result[];
  actionPlan: ActionPlanItem[];
}

/** Everything persisted for one account (cache + sync payload). */
export interface AccountDoc {
  learners: LearnerProfile[];
  activeLearnerId: string | null;
  workspaces: Record<string, LearnerWorkspace>;
  settings: AppSettings;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
