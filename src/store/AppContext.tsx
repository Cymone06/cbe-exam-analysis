/* eslint-disable react-refresh/only-export-components -- context provider + hook must live together */
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState, AccountDoc, AppSettings, LearnerProfile, LearnerWorkspace,
  SyncStatus, LearningArea, Strand, SubStrand, SLO, CoreCompetency,
  Exam, Question, Result, ActionPlanItem,
} from '@/types';
import { loadAccountDoc, saveAccountDoc, loadLegacyState } from './db';
import type { SyncOp } from '@/services/syncEngine';
import { SyncManager } from '@/store/sync';
import {
  dataRepository, mappers, rowsToWorkspace,
  type SyncTable,
} from '@/services/dataRepository';
import { diffWorkspace } from '@/services/workspaceDiff';
import { useAuth } from '@/auth/AuthContext';
import { seedState } from '@/data/seed';
import { importLegacyState, type ImportProgress } from '@/services/migration';

// ─── Action types ─────────────────────────────────────────────────────────────

export type Action =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SET_LEARNER'; payload: LearnerProfile }
  // Multi-learner (v2)
  | { type: 'SET_ACCOUNT'; payload: { learners: LearnerProfile[]; activeLearnerId: string | null; settings?: Partial<AppSettings> } }
  | { type: 'ADD_LEARNER'; payload: LearnerProfile }
  | { type: 'UPDATE_LEARNER'; payload: LearnerProfile }
  | { type: 'ARCHIVE_LEARNER'; payload: { id: string; archivedAt: string | null } }
  | { type: 'DELETE_LEARNER'; payload: string }
  | { type: 'SWITCH_LEARNER'; payload: { id: string; workspace: LearnerWorkspace } }
  // Learning areas
  | { type: 'ADD_LEARNING_AREA'; payload: LearningArea }
  | { type: 'UPDATE_LEARNING_AREA'; payload: LearningArea }
  | { type: 'DELETE_LEARNING_AREA'; payload: string }
  // Strands
  | { type: 'ADD_STRAND'; payload: Strand }
  | { type: 'UPDATE_STRAND'; payload: Strand }
  | { type: 'DELETE_STRAND'; payload: string }
  // Sub-strands
  | { type: 'ADD_SUB_STRAND'; payload: SubStrand }
  | { type: 'UPDATE_SUB_STRAND'; payload: SubStrand }
  | { type: 'DELETE_SUB_STRAND'; payload: string }
  // SLOs
  | { type: 'ADD_SLO'; payload: SLO }
  | { type: 'UPDATE_SLO'; payload: SLO }
  | { type: 'DELETE_SLO'; payload: string }
  | { type: 'REASSIGN_QUESTIONS_FROM_SLO'; payload: { fromSloId: string; toSloId: string } }
  // Competencies
  | { type: 'ADD_COMPETENCY'; payload: CoreCompetency }
  | { type: 'UPDATE_COMPETENCY'; payload: CoreCompetency }
  | { type: 'DELETE_COMPETENCY'; payload: string }
  // Exams
  | { type: 'ADD_EXAM'; payload: Exam }
  | { type: 'UPDATE_EXAM'; payload: Exam }
  | { type: 'DELETE_EXAM'; payload: string }
  // Questions (managed via exam update, but helper actions for convenience)
  | { type: 'UPDATE_QUESTIONS'; payload: { examId: string; questions: Question[] } }
  // Results
  | { type: 'SAVE_RESULTS'; payload: { examId: string; results: Result[] } }
  // Action plan
  | { type: 'ADD_ACTION_ITEM'; payload: ActionPlanItem }
  | { type: 'UPDATE_ACTION_ITEM'; payload: ActionPlanItem }
  | { type: 'DELETE_ACTION_ITEM'; payload: string }
  | { type: 'TOGGLE_ACTION_ITEM'; payload: string }
  // Settings
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'DISMISS_SEED' }
  // Data management
  | { type: 'RESET_SAMPLE_DATA' }
  | { type: 'CLEAR_ALL_DATA' }
  // Remote-synced changes (merged live; LWW already applied by the sync engine)
  | { type: 'MERGE_REMOTE'; payload: { table: SyncTable; rows: Record<string, unknown>[] } };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'SET_LEARNER':
      return { ...state, learner: action.payload };

    // Multi-learner
    case 'SET_ACCOUNT':
      return {
        ...state,
        learners: action.payload.learners,
        activeLearnerId: action.payload.activeLearnerId,
        learner: action.payload.learners.find((l) => l.id === action.payload.activeLearnerId) ?? state.learner,
        settings: { ...state.settings, ...action.payload.settings },
      };
    case 'ADD_LEARNER':
      return { ...state, learners: [...state.learners, action.payload] };
    case 'UPDATE_LEARNER':
      return {
        ...state,
        learners: state.learners.map((l) => (l.id === action.payload.id ? action.payload : l)),
        learner: state.activeLearnerId === action.payload.id ? action.payload : state.learner,
      };
    case 'ARCHIVE_LEARNER':
      return {
        ...state,
        learners: state.learners.map((l) =>
          l.id === action.payload.id ? { ...l, archivedAt: action.payload.archivedAt } : l),
      };
    case 'DELETE_LEARNER': {
      const learners = state.learners.filter((l) => l.id !== action.payload);
      return {
        ...state,
        learners,
        activeLearnerId: state.activeLearnerId === action.payload ? learners[0]?.id ?? null : state.activeLearnerId,
        learner: state.learner?.id === action.payload ? learners[0] ?? null : state.learner,
      };
    }
    case 'SWITCH_LEARNER': {
      const profile = state.learners.find((l) => l.id === action.payload.id) ?? null;
      return { ...state, activeLearnerId: action.payload.id, learner: profile, ...action.payload.workspace };
    }

    // Learning areas
    case 'ADD_LEARNING_AREA':
      return { ...state, learningAreas: [...state.learningAreas, action.payload] };
    case 'UPDATE_LEARNING_AREA':
      return { ...state, learningAreas: state.learningAreas.map((la) => la.id === action.payload.id ? action.payload : la) };
    case 'DELETE_LEARNING_AREA': {
      const areaId = action.payload;
      const strandIds = state.strands.filter((s) => s.learningAreaId === areaId).map((s) => s.id);
      const subStrandIds = state.subStrands.filter((ss) => strandIds.includes(ss.strandId)).map((ss) => ss.id);
      const sloIds = state.slos.filter((slo) => subStrandIds.includes(slo.subStrandId)).map((slo) => slo.id);
      const removedExamIds = state.exams.filter((e) => e.learningAreaId === areaId).map((e) => e.id);
      return cascadeDelete(
        {
          ...state,
          learningAreas: state.learningAreas.filter((la) => la.id !== areaId),
          strands: state.strands.filter((s) => s.learningAreaId !== areaId),
          subStrands: state.subStrands.filter((ss) => !strandIds.includes(ss.strandId)),
          slos: state.slos.filter((slo) => !subStrandIds.includes(slo.subStrandId)),
          exams: state.exams.filter((e) => !removedExamIds.includes(e.id)),
        },
        sloIds,
      );
    }

    // Strands
    case 'ADD_STRAND':
      return { ...state, strands: [...state.strands, action.payload] };
    case 'UPDATE_STRAND':
      return { ...state, strands: state.strands.map((s) => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_STRAND': {
      const strandId = action.payload;
      const subStrandIds = state.subStrands.filter((ss) => ss.strandId === strandId).map((ss) => ss.id);
      const sloIds = state.slos.filter((slo) => subStrandIds.includes(slo.subStrandId)).map((slo) => slo.id);
      return cascadeDelete(
        {
          ...state,
          strands: state.strands.filter((s) => s.id !== strandId),
          subStrands: state.subStrands.filter((ss) => ss.strandId !== strandId),
          slos: state.slos.filter((slo) => !subStrandIds.includes(slo.subStrandId)),
        },
        sloIds,
      );
    }

    // Sub-strands
    case 'ADD_SUB_STRAND':
      return { ...state, subStrands: [...state.subStrands, action.payload] };
    case 'UPDATE_SUB_STRAND':
      return { ...state, subStrands: state.subStrands.map((ss) => ss.id === action.payload.id ? action.payload : ss) };
    case 'DELETE_SUB_STRAND': {
      const subStrandId = action.payload;
      const sloIds = state.slos.filter((slo) => slo.subStrandId === subStrandId).map((slo) => slo.id);
      return cascadeDelete(
        {
          ...state,
          subStrands: state.subStrands.filter((ss) => ss.id !== subStrandId),
          slos: state.slos.filter((slo) => slo.subStrandId !== subStrandId),
        },
        sloIds,
      );
    }

    // SLOs
    case 'ADD_SLO':
      return { ...state, slos: [...state.slos, action.payload] };
    case 'UPDATE_SLO':
      return { ...state, slos: state.slos.map((s) => s.id === action.payload.id ? action.payload : s) };
    case 'REASSIGN_QUESTIONS_FROM_SLO': {
      const { fromSloId, toSloId } = action.payload;
      return {
        ...state,
        exams: state.exams.map((e) => ({
          ...e,
          questions: e.questions.map((q) => (q.sloId === fromSloId ? { ...q, sloId: toSloId } : q)),
        })),
        // Keep existing remedial work attached to the new SLO
        actionPlan: state.actionPlan.map((i) => (i.sloId === fromSloId ? { ...i, sloId: toSloId } : i)),
      };
    }
    case 'DELETE_SLO':
      return cascadeDelete(
        { ...state, slos: state.slos.filter((s) => s.id !== action.payload) },
        [action.payload],
      );

    // Competencies
    case 'ADD_COMPETENCY':
      return { ...state, competencies: [...state.competencies, action.payload] };
    case 'UPDATE_COMPETENCY':
      return { ...state, competencies: state.competencies.map((c) => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_COMPETENCY':
      return {
        ...state,
        competencies: state.competencies.filter((c) => c.id !== action.payload),
        exams: state.exams.map((e) => ({
          ...e,
          questions: e.questions.map((q) => ({
            ...q,
            competencyIds: q.competencyIds.filter((cid) => cid !== action.payload),
          })),
        })),
      };

    // Exams
    case 'ADD_EXAM':
      return { ...state, exams: [...state.exams, action.payload] };
    case 'UPDATE_EXAM': {
      const exam = action.payload;
      const questionIds = new Set(exam.questions.map((q) => q.id));
      return {
        ...state,
        exams: state.exams.map((e) => (e.id === exam.id ? exam : e)),
        // Prune results orphaned by deleted questions
        results: state.results.filter((r) => r.examId !== exam.id || questionIds.has(r.questionId)),
      };
    }
    case 'DELETE_EXAM': {
      const examId = action.payload;
      return {
        ...state,
        exams: state.exams.filter((e) => e.id !== examId),
        results: state.results.filter((r) => r.examId !== examId),
      };
    }
    case 'UPDATE_QUESTIONS':
      return {
        ...state,
        exams: state.exams.map((e) =>
          e.id === action.payload.examId
            ? { ...e, questions: action.payload.questions }
            : e
        ),
      };

    // Results
    case 'SAVE_RESULTS': {
      const { examId, results } = action.payload;
      const without = state.results.filter((r) => r.examId !== examId);
      return { ...state, results: [...without, ...results] };
    }

    // Action plan
    case 'ADD_ACTION_ITEM':
      return { ...state, actionPlan: [...state.actionPlan, action.payload] };
    case 'UPDATE_ACTION_ITEM':
      return { ...state, actionPlan: state.actionPlan.map((i) => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_ACTION_ITEM':
      return { ...state, actionPlan: state.actionPlan.filter((i) => i.id !== action.payload) };
    case 'TOGGLE_ACTION_ITEM':
      return { ...state, actionPlan: state.actionPlan.map((i) => i.id === action.payload ? { ...i, completed: !i.completed } : i) };

    // Settings
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'DISMISS_SEED':
      return { ...state, seedDismissed: true };

    case 'RESET_SAMPLE_DATA':
      return { ...seedState, seedDismissed: false };

    case 'CLEAR_ALL_DATA':
      return { ...INITIAL_STATE, seedDismissed: true, learner: null };

    // Remote merge — applies rows whose learner matches the active workspace;
    // rows for other learners are kept in the account cache by the SyncManager.
    case 'MERGE_REMOTE': {
      const { table, rows } = action.payload;
      const active = state.activeLearnerId;
      if (!active) return state;
      const activeRows = rows.filter((r) => (r.learnerId ?? r.learner_id) === active && !r.deleted_at);
      if (activeRows.length === 0) return state;
      switch (table) {
        case 'learning_areas':
          return { ...state, learningAreas: mergeById(state.learningAreas, activeRows) };
        case 'strands':
          return { ...state, strands: mergeById(state.strands, activeRows) };
        case 'sub_strands':
          return { ...state, subStrands: mergeById(state.subStrands, activeRows) };
        case 'slos':
          return { ...state, slos: mergeById(state.slos, activeRows) };
        case 'competencies':
          return { ...state, competencies: mergeById(state.competencies, activeRows) };
        case 'exams':
          return {
            ...state,
            exams: mergeById(state.exams, activeRows).map((e) => ({
              ...e,
              // keep locally known questions until the questions rows arrive
              questions: state.exams.find((x) => x.id === e.id)?.questions ?? e.questions ?? [],
            })),
          };
        case 'questions': {
          const mergedQ = mergeById(
            state.exams.flatMap((e) => e.questions) as unknown as { id: string }[],
            activeRows as unknown as Record<string, unknown>[],
          ) as unknown as Question[];
          return {
            ...state,
            exams: state.exams.map((e) => ({
              ...e,
              questions: mergedQ
                .filter((q) => q.examId === e.id)
                .sort((a, b) => a.number - b.number),
            })),
          };
        }
        case 'results':
          return { ...state, results: mergeById(state.results, activeRows) };
        case 'action_plan_items':
          return { ...state, actionPlan: mergeById(state.actionPlan, activeRows) };
        case 'learners':
          return { ...state, learners: mergeById(state.learners, activeRows) };
        default:
          return state;
      }
    }

    default:
      return state;
  }
}

function mergeById<T extends { id: string }>(current: T[], rows: Record<string, unknown>[]): T[] {
  const byId = new Map<string, T>(current.map((r) => [r.id, r]));
  for (const row of rows) {
    if (row.id == null) continue;
    byId.set(row.id as string, { ...byId.get(row.id as string), ...row } as unknown as T);
  }
  return Array.from(byId.values());
}

/** Remove questions/results/action items orphaned by the deletion of SLOs. */
function cascadeDelete(state: AppState, deletedSloIds: string[]): AppState {
  if (deletedSloIds.length === 0) return state;
  const removed = new Set(deletedSloIds);
  const exams = state.exams.map((e) => ({
    ...e,
    questions: e.questions.filter((q) => !removed.has(q.sloId)),
  }));
  const questionIds = new Set(exams.flatMap((e) => e.questions.map((q) => q.id)));
  return {
    ...state,
    exams,
    results: state.results.filter((r) => questionIds.has(r.questionId)),
    actionPlan: state.actionPlan.filter((i) => !removed.has(i.sloId)),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  loading: boolean;
  /** Sync status for the header indicator (REQ-SY3). */
  sync: { status: SyncStatus; pending: number; error: string | null };
  retrySync(): void;
  /** Learner management (v2). */
  switchLearner(id: string): Promise<void>;
  createLearner(input: { name: string; grade: number; school?: string; year?: string; colour?: string }): Promise<LearnerProfile>;
  updateLearner(id: string, patch: Partial<LearnerProfile>): Promise<void>;
  archiveLearner(id: string, archived: boolean): Promise<void>;
  deleteLearner(id: string): Promise<void>;
  /** Copy another learner's curriculum into the active learner's workspace. */
  copyCurriculum(fromLearnerId: string): Promise<void>;
  /** Adds a learner pre-loaded with the sample (Basic 6) data. */
  addSampleLearner(): Promise<void>;
  /** Legacy single-learner data migration (REQ-MG1). */
  legacyDataAvailable: boolean;
  importLegacyData(): Promise<void>;
  importProgress: ImportProgress | null;
  signingOut?: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export const INITIAL_STATE: AppState = {
  learner: null,
  learners: [],
  activeLearnerId: null,
  learningAreas: [],
  strands: [],
  subStrands: [],
  slos: [],
  competencies: [],
  exams: [],
  results: [],
  actionPlan: [],
  settings: { subLevelEnabled: false, thresholds: { EE: 75, ME: 50, AE: 25 }, theme: 'light' },
  seedDismissed: false,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { accountId, user } = useAuth();
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<{ status: SyncStatus; pending: number; error: string | null }>({ status: 'idle', pending: 0, error: null });
  const [legacyDataAvailable, setLegacyDataAvailable] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const syncRef = useRef<SyncManager | null>(null);
  const prevWorkspaceRef = useRef<LearnerWorkspace | null>(null);
  const prevSettingsRef = useRef<AppSettings | null>(null);
  const saveBusy = useRef(false);

  /* ── Boot per account: cache first → optional initial cloud pull ────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
       
      setLoading(true);
      const doc = await loadAccountDoc(accountId);

      if (doc?.learners?.length) {
        // Cached doc → hydrate instantly (works offline, REQ-SY1).
        if (cancelled) return;
        const activeId = doc.activeLearnerId ?? doc.learners[0].id;
        const ws = doc.workspaces[activeId] ?? emptyWorkspace();
        dispatch({ type: 'LOAD_STATE', payload: { learners: doc.learners, activeLearnerId: activeId, learner: doc.learners.find((l) => l.id === activeId) ?? null, settings: doc.settings, ...ws } });
        prevWorkspaceRef.current = ws;
        prevSettingsRef.current = doc.settings;
      } else if (user) {
        // First login on this device → initial pull from the cloud (REQ-SY3).
        try {
          const remote = await dataRepository.pullAll(user.userId);
          const learners = (remote.learners ?? []).map(mappers.learners.toDomain!) as unknown as LearnerProfile[];
          if (learners.length > 0) {
            const activeId = doc?.activeLearnerId ?? learners[0].id;
            const workspaces: Record<string, LearnerWorkspace> = {};
            for (const l of learners) workspaces[l.id] = rowsToWorkspace(remote, l.id);
            const settings: AppSettings = doc?.settings ?? INITIAL_STATE.settings;
            await saveAccountDoc(accountId, { learners, activeLearnerId: activeId, workspaces, settings });
            if (cancelled) return;
            const ws = workspaces[activeId] ?? emptyWorkspace();
            dispatch({ type: 'LOAD_STATE', payload: { learners, activeLearnerId: activeId, learner: learners.find((l) => l.id === activeId) ?? null, settings, ...ws } });
            prevWorkspaceRef.current = ws;
            prevSettingsRef.current = settings;
          } else {
            // Empty cloud account → blank workspace; offer legacy import below.
            dispatch({ type: 'CLEAR_ALL_DATA' });
          }
        } catch (err) {
          console.warn('Initial cloud sync failed — continuing offline', err);
        }
      } else {
        // Signed-out local mode → blank workspace; offer legacy import below.
        dispatch({ type: 'CLEAR_ALL_DATA' });
      }

      // Signed-out local mode keeps the v1 first-launch experience (REQ-SD1):
      // no cached document ⇒ load the sample learner so the dashboard is not
      // empty. Signed-in cloud accounts instead get the explicit
      // "Add sample learner" action / legacy import (REQ-MG1).
      const emptyAccount = !doc?.learners?.length;
      const legacy = emptyAccount ? await loadLegacyState() : null;

      if (accountId === 'local' && emptyAccount && !legacy) {
        const ws: LearnerWorkspace = {
          learningAreas: seedState.learningAreas,
          strands: seedState.strands,
          subStrands: seedState.subStrands,
          slos: seedState.slos,
          competencies: seedState.competencies,
          exams: seedState.exams,
          results: seedState.results,
          actionPlan: seedState.actionPlan,
        };
        await saveAccountDoc(accountId, {
          learners: seedState.learners as LearnerProfile[],
          activeLearnerId: seedState.activeLearnerId ?? null,
          workspaces: { [seedState.learner!.id]: ws },
          settings: seedState.settings,
        });
        if (cancelled) return;
        prevWorkspaceRef.current = ws;
        prevSettingsRef.current = seedState.settings;
        dispatch({ type: 'LOAD_STATE', payload: { ...seedState } });
        setLegacyDataAvailable(false);
      } else {
        // Legacy single-learner migration offer (REQ-MG1) — only when empty,
        // and only when there is genuinely stored data to import.
        setLegacyDataAvailable(Boolean(legacy));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boots when the auth account changes
  }, [accountId, user?.userId]);

  /* ── Sync manager lifecycle (outbox flush + realtime) ───────────────────── */
  const userId = user?.userId;
  useEffect(() => {
    if (!userId) {
      syncRef.current?.dispose();
      syncRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- teardown when signing out
      setSync({ status: 'idle', pending: 0, error: null });
      return;
    }
    const manager = new SyncManager(userId, (info) => setSync(() => ({ ...info, error: null })));
    // Live-apply remote rows into the reducer (MERGE_REMOTE handles tombstones by filter).
    manager.remoteListener = (table, row) => {
      dispatch({ type: 'MERGE_REMOTE', payload: { table, rows: [row as Record<string, unknown>] } });
    };
    manager.startRealtime(userId);
    syncRef.current = manager;
    return () => manager.dispose();
  }, [userId]);

  /* ── Persist every commit to the cache + enqueue cloud ops (REQ-SY1) ─────── */
  useEffect(() => {
    if (loading || saveBusy.current) return;
    const activeId = state.activeLearnerId;
    const workspace: LearnerWorkspace = {
      learningAreas: state.learningAreas,
      strands: state.strands,
      subStrands: state.subStrands,
      slos: state.slos,
      competencies: state.competencies,
      exams: state.exams,
      results: state.results,
      actionPlan: state.actionPlan,
    };

    void (async () => {
      const doc = await loadAccountDoc(accountId) ?? emptyDoc(state.settings);
      const workspaces = { ...doc.workspaces };
      if (activeId) workspaces[activeId] = workspace;

      // learner profile row upserts & settings only when they actually changed
      let learnersOutbox: SyncOp[] = [];
      const learnersChanged = doc.learners.map((l) => JSON.stringify(l)).join('|') !==
        state.learners.map((l) => JSON.stringify(l)).join('|');
      if (learnersChanged && userId) {
        learnersOutbox = [];
        for (const l of state.learners) {
          const before = doc.learners.find((d) => (d as LearnerProfile).id === l.id);
          if (!before || JSON.stringify(before) !== JSON.stringify(l)) {
            learnersOutbox.push(toUpsertOp('learners', l as unknown as Record<string, unknown>, userId, l.id));
          }
        }
        // tombstone removed learners
        for (const b of doc.learners) {
          if (!state.learners.some((l) => l.id === (b as LearnerProfile).id)) {
            learnersOutbox.push({ kind: 'delete', table: 'learners', id: (b as LearnerProfile).id });
          }
        }
      }
      const settingsChanged = prevSettingsRef.current !== null &&
        JSON.stringify(prevSettingsRef.current) !== JSON.stringify(state.settings);
      prevSettingsRef.current = state.settings;

      await saveAccountDoc(accountId, {
        ...doc,
        learners: state.learners,
        activeLearnerId: activeId ?? doc.activeLearnerId,
        workspaces,
        settings: state.settings,
      });

      const manager = syncRef.current;
      if (manager) {
        const ops = diffWorkspace(prevWorkspaceRef.current ?? emptyWorkspace(), workspace, activeId ?? '', userId);
        prevWorkspaceRef.current = workspace;
        const all = [...learnersOutbox, ...ops];
        if (all.length > 0) await manager.enqueue(all);
        if (settingsChanged) {
          await dataRepository.saveSettings(userId as string, state.settings as unknown as Record<string, unknown>);
        }
      }
    })();
     
  }, [state, loading, accountId, userId]);

  /* ── Theme ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const html = document.documentElement;
    if (state.settings.theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }, [state.settings.theme]);

  const api = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    loading,
    sync,
    retrySync: () => syncRef.current?.retryNow(),
    async switchLearner(id) {
      const doc = await loadAccountDoc(accountId);
      if (!doc) return;
      const ws = doc.workspaces[id] ?? emptyWorkspace();
      prevWorkspaceRef.current = ws;
      dispatch({ type: 'SWITCH_LEARNER', payload: { id, workspace: ws } });
      await saveAccountDoc(accountId, { ...doc, activeLearnerId: id });
    },
    async createLearner(input) {
      const colour = input.colour ?? PALETTE[state.learners.length % PALETTE.length];
      const learner: LearnerProfile = {
        id: newId('learner'),
        name: input.name,
        grade: input.grade,
        school: input.school ?? '',
        year: input.year ?? String(new Date().getFullYear()),
        colour,
        archivedAt: null,
      };
      // Start the learner with the grade curriculum template so they're productive immediately.
      const tpl = templateForGrade();
      const ws: LearnerWorkspace = {
        learningAreas: tpl.learningAreas,
        strands: tpl.strands,
        subStrands: tpl.subStrands,
        slos: tpl.slos,
        competencies: tpl.competencies,
        exams: [],
        results: [],
        actionPlan: [],
      };
      const doc = await loadAccountDoc(accountId) ?? emptyDoc(state.settings);
      await saveAccountDoc(accountId, {
        ...doc,
        learners: [...doc.learners, learner],
        workspaces: { ...doc.workspaces, [learner.id]: ws },
        activeLearnerId: doc.activeLearnerId ?? learner.id,
      });
      dispatch({ type: 'ADD_LEARNER', payload: learner });
      if (!state.activeLearnerId) {
        prevWorkspaceRef.current = ws;
        dispatch({ type: 'SWITCH_LEARNER', payload: { id: learner.id, workspace: ws } });
      }
      return learner;
    },
    async updateLearner(id, patch) {
      const current = state.learners.find((l) => l.id === id);
      if (!current) return;
      const updated = { ...current, ...patch };
      dispatch({ type: 'UPDATE_LEARNER', payload: updated });
      const doc = await loadAccountDoc(accountId);
      if (doc) {
        await saveAccountDoc(accountId, {
          ...doc,
          learners: doc.learners.map((l) => ((l as LearnerProfile).id === id ? { ...l, ...patch } : l)) as LearnerProfile[],
        });
      }
    },
    async archiveLearner(id, archived) {
      const archivedAt = archived ? new Date().toISOString() : null;
      dispatch({ type: 'ARCHIVE_LEARNER', payload: { id, archivedAt } });
      const doc = await loadAccountDoc(accountId);
      if (doc) {
        await saveAccountDoc(accountId, {
          ...doc,
          learners: doc.learners.map((l) => ((l as LearnerProfile).id === id ? { ...l, archivedAt } : l)) as LearnerProfile[],
        });
      }
    },
    async deleteLearner(id) {
      const doc = await loadAccountDoc(accountId);
      dispatch({ type: 'DELETE_LEARNER', payload: id });
      if (doc) {
        const workspaces = { ...doc.workspaces };
        delete workspaces[id];
        await saveAccountDoc(accountId, {
          ...doc,
          learners: doc.learners.filter((l) => (l as LearnerProfile).id !== id),
          workspaces,
          activeLearnerId: doc.activeLearnerId === id ? (doc.learners.find((l) => (l as LearnerProfile).id !== id) as LearnerProfile | undefined)?.id ?? null : doc.activeLearnerId,
        });
      }
      // Cloud soft-delete: children cascade via FK on delete (learners row tombstoned)
      const manager = syncRef.current;
      if (manager) await manager.enqueue([{ kind: 'delete', table: 'learners', id } as SyncOp]);
    },
    async copyCurriculum(fromLearnerId) {
      const doc = await loadAccountDoc(accountId);
      const activeId = state.activeLearnerId;
      const source = doc?.workspaces[fromLearnerId];
      if (!source || !activeId) return;
      const fresh = withFreshIds(source);
      await saveAccountDoc(accountId, {
        ...doc,
        workspaces: { ...doc.workspaces, [activeId]: { ...fresh } },
      });
      dispatch({ type: 'LOAD_STATE', payload: fresh });
    },
    async addSampleLearner() {
      const learner: LearnerProfile = {
        id: newId('learner'),
        name: seedState.learner?.name ?? 'Sample Learner',
        grade: seedState.learner?.grade ?? 6,
        school: seedState.learner?.school ?? '',
        year: seedState.learner?.year ?? String(new Date().getFullYear()),
        colour: PALETTE[state.learners.length % PALETTE.length],
        archivedAt: null,
      };
      const ws: LearnerWorkspace = {
        learningAreas: seedState.learningAreas,
        strands: seedState.strands,
        subStrands: seedState.subStrands,
        slos: seedState.slos,
        competencies: seedState.competencies,
        exams: seedState.exams,
        results: seedState.results,
        actionPlan: seedState.actionPlan,
      };
      const doc = await loadAccountDoc(accountId) ?? emptyDoc(state.settings);
      await saveAccountDoc(accountId, {
        ...doc,
        learners: [...doc.learners, learner],
        workspaces: { ...doc.workspaces, [learner.id]: ws },
        activeLearnerId: doc.activeLearnerId ?? learner.id,
      });
      dispatch({ type: 'ADD_LEARNER', payload: learner });
      if (!state.activeLearnerId) {
        prevWorkspaceRef.current = ws;
        dispatch({ type: 'SWITCH_LEARNER', payload: { id: learner.id, workspace: ws } });
      }
    },
    legacyDataAvailable,
    async importLegacyData() {
      setImportProgress({ stage: 'backup', done: false });
      void (async () => {
        try {
          const legacy = await loadLegacyState();
          if (!legacy) throw new Error('No existing local data was found to import.');
          const doc = await loadAccountDoc(accountId) ?? emptyDoc(state.settings);
          const result = await importLegacyState(legacy, doc, accountId, setImportProgress);
          await saveAccountDoc(accountId, result);
          setLegacyDataAvailable(false);
          dispatch({ type: 'SET_ACCOUNT', payload: { learners: result.learners, activeLearnerId: result.activeLearnerId, settings: result.settings } });
          const ws = result.workspaces[result.activeLearnerId as string] ?? emptyWorkspace();
          prevWorkspaceRef.current = ws;
          dispatch({ type: 'LOAD_STATE', payload: ws });
          setImportProgress({ stage: 'done', done: true });
        } catch (err) {
          setImportProgress({ stage: 'error', done: true, error: err instanceof Error ? err.message : 'Import failed' });
        }
      })();
    },
    importProgress,
  }), [state, loading, sync, accountId, legacyDataAvailable, importProgress, userId]);

  return (
    <AppContext.Provider value={api}>
      {children}
    </AppContext.Provider>
  );
}

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
let seqCounter = 0;
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${seqCounter++}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyWorkspace(): LearnerWorkspace {
  return { learningAreas: [], strands: [], subStrands: [], slos: [], competencies: [], exams: [], results: [], actionPlan: [] };
}

function emptyDoc(settings: AppSettings): AccountDoc {
  return { learners: [], activeLearnerId: null, workspaces: {}, settings };
}

function toUpsertOp(table: SyncTable, entity: Record<string, unknown>, userId: string, learnerId: string | null): SyncOp {
  return {
    kind: 'upsert',
    table,
    row: {
      ...mappers[table].fromDomain(entity),
      user_id: userId,
      learner_id: learnerId,
    },
  };
}

/** Grade template: the Basic-6 seed curriculum, fresh ids. */
function templateForGrade(): Pick<LearnerWorkspace, 'learningAreas' | 'strands' | 'subStrands' | 'slos' | 'competencies'> {
  const suffix = newId('tpl');
  const laMap = new Map<string, string>();
  const strandMap = new Map<string, string>();
  const ssMap = new Map<string, string>();
  return {
    learningAreas: seedState.learningAreas.map((a) => {
      const id = `${a.id}-${suffix}`; laMap.set(a.id, id); return { ...a, id };
    }),
    strands: seedState.strands.map((s) => {
      const id = `${s.id}-${suffix}`; strandMap.set(s.id, id); return { ...s, id, learningAreaId: laMap.get(s.learningAreaId) ?? s.learningAreaId };
    }),
    subStrands: seedState.subStrands.map((ss) => {
      const id = `${ss.id}-${suffix}`; ssMap.set(ss.id, id); return { ...ss, id, strandId: strandMap.get(ss.strandId) ?? ss.strandId };
    }),
    slos: seedState.slos.map((s) => ({ ...s, id: `${s.id}-${suffix}`, subStrandId: ssMap.get(s.subStrandId) ?? s.subStrandId })),
    competencies: seedState.competencies.map((c) => ({ ...c, id: `${c.id}-${suffix}` })),
  };
}

/** Copy a curriculum with fresh ids, keeping internal references consistent. */
function withFreshIds(ws: LearnerWorkspace): LearnerWorkspace {
  const suffix = newId('copy');
  const laMap = new Map<string, string>();
  const strandMap = new Map<string, string>();
  const ssMap = new Map<string, string>();
  return {
    learningAreas: ws.learningAreas.map((a) => {
      const id = `${a.id}-${suffix}`; laMap.set(a.id, id); return { ...a, id };
    }),
    strands: ws.strands.map((s) => {
      const id = `${s.id}-${suffix}`; strandMap.set(s.id, id); return { ...s, id, learningAreaId: laMap.get(s.learningAreaId) ?? s.learningAreaId };
    }),
    subStrands: ws.subStrands.map((ss) => {
      const id = `${ss.id}-${suffix}`; ssMap.set(ss.id, id); return { ...ss, id, strandId: strandMap.get(ss.strandId) ?? ss.strandId };
    }),
    slos: ws.slos.map((s) => ({ ...s, id: `${s.id}-${suffix}`, subStrandId: ssMap.get(s.subStrandId) ?? s.subStrandId })),
    competencies: ws.competencies.map((c) => ({ ...c, id: `${c.id}-${suffix}` })),
    exams: [],
    results: [],
    actionPlan: [],
  };
}

/* eslint-enable */

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
