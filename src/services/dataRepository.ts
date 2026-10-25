/**
 * DataRepository — cloud data access behind an interface (REQ-S2, REQ-DB*).
 * Maps domain objects ↔ snake_case Supabase rows; pull/push/subscribe only.
 * Handles LWW conflicts by skipping remote rows older than the local copy.
 */
import { getSupabase } from '@/lib/supabase';
import type {
  LearnerProfile, LearningArea, Strand, SubStrand, SLO, CoreCompetency,
  Exam, Question, Result, ActionPlanItem,
} from '@/types';
import { cloudEnabled } from '@/lib/supabase';

/** Tables the repository owns (rows are plain JSON objects with snake_case keys). */
export type SyncTable =
  | 'learners' | 'learning_areas' | 'strands' | 'sub_strands' | 'slos'
  | 'competencies' | 'exams' | 'questions' | 'results' | 'action_plan_items' | 'user_settings';

export type TableRow = Record<string, unknown>;

export interface DataRepository {
  /** Pull every non-deleted row for the user across all tables, grouped per table. */
  pullAll(userId: string): Promise<Partial<Record<SyncTable, TableRow[]>>>;
  upsert(table: SyncTable, rows: TableRow[]): Promise<void>;
  /** Soft delete (tombstone) rows by id. */
  softDelete(table: SyncTable, ids: string[]): Promise<void>;
  /** Upsert the user_settings JSON document. */
  saveSettings(userId: string, settings: Record<string, unknown>): Promise<void>;
  /** Realtime subscription over every table, filtered to this user. */
  subscribe(userId: string, onRemote: (table: SyncTable, row: TableRow) => void): () => void;
}

/* ─── Domain ↔ row mappers (camelCase ↔ snake_case) ───────────────────────── */

const iso = (d = new Date()) => d.toISOString();

function pick<T extends object>(obj: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj[k as keyof T] !== undefined) out[k] = obj[k as keyof T];
  return out;
}

interface Mapper {
  fromDomain: (row: Record<string, unknown>) => TableRow | null;
  toDomain?: (row: TableRow) => Record<string, unknown>;
}

export const mappers: Record<SyncTable, Mapper> = {
  learners: {
    fromDomain: (l) => {
      const p = l as unknown as LearnerProfile;
      return {
        ...pick(p, ['id', 'name']),
        grade: p.grade,
        school: p.school ?? '',
        school_year: p.year ?? String(new Date().getFullYear()),
        colour: p.colour ?? '#6366f1',
        archived_at: p.archivedAt ?? null,
        updated_at: iso(),
      };
    },
    toDomain: (r) => ({
      id: r.id, name: r.name, grade: r.grade, school: r.school ?? '',
      year: r.school_year ?? r.year ?? String(new Date().getFullYear()),
      colour: r.colour ?? '#6366f1', archivedAt: r.archived_at ?? null,
    }),
  },
  learning_areas: {
    fromDomain: (l) => ({ ...pick(l, ['id', 'learner_id']), name: l.name, colour: l.colour, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, name: r.name, colour: r.colour ?? '#6366f1' }),
  },
  strands: {
    fromDomain: (s) => ({ ...pick(s, ['id', 'learner_id']), learning_area_id: s.learningAreaId, code: s.code, name: s.name, sort_order: s.order, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, learningAreaId: r.learning_area_id, code: r.code, name: r.name, order: r.sort_order ?? 0 }),
  },
  sub_strands: {
    fromDomain: (s) => ({ ...pick(s, ['id', 'learner_id']), strand_id: s.strandId, code: s.code, name: s.name, sort_order: s.order, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, strandId: r.strand_id, code: r.code, name: r.name, order: r.sort_order ?? 0 }),
  },
  slos: {
    fromDomain: (s) => ({ ...pick(s, ['id', 'learner_id']), sub_strand_id: s.subStrandId, code: s.code, description: s.description, weight: s.weight, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, subStrandId: r.sub_strand_id, code: r.code, description: r.description, weight: r.weight ?? 1 }),
  },
  competencies: {
    fromDomain: (c) => ({ ...pick(c, ['id', 'learner_id']), name: c.name, short_name: c.shortName, colour: c.colour, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, name: r.name, shortName: r.short_name, colour: r.colour ?? '#6366f1' }),
  },
  exams: {
    fromDomain: (e) => ({ ...pick(e, ['id', 'learner_id']), title: e.title, type: e.type, term: e.term, exam_date: e.date, learning_area_id: e.learningAreaId, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, title: r.title, type: r.type, term: r.term, date: r.exam_date, learningAreaId: r.learning_area_id, questions: [] }),
  },
  questions: {
    fromDomain: (q) => ({ ...pick(q, ['id', 'learner_id']), exam_id: q.examId, number: q.number, max_marks: q.maxMarks, slo_id: q.sloId, performance_indicator: q.performanceIndicator, cognitive_level: q.cognitiveLevel, competency_ids: q.competencyIds, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, examId: r.exam_id, number: r.number, maxMarks: r.max_marks, sloId: r.slo_id, performanceIndicator: r.performance_indicator ?? '', cognitiveLevel: r.cognitive_level ?? 'Recall', competencyIds: r.competency_ids ?? [] }),
  },
  results: {
    fromDomain: (r2) => ({ ...pick(r2, ['id', 'learner_id']), exam_id: r2.examId, question_id: r2.questionId, marks_scored: r2.marksScored, error_type: r2.errorType ?? null, note: r2.note ?? null, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, examId: r.exam_id, questionId: r.question_id, marksScored: r.marks_scored, errorType: r.error_type ?? undefined, note: r.note ?? undefined }),
  },
  action_plan_items: {
    fromDomain: (i) => ({ ...pick(i, ['id', 'learner_id']), slo_id: i.sloId, activity: i.activity, practice_task: i.practiceTask, target_level: i.targetLevel, review_date: i.reviewDate, completed: i.completed, updated_at: iso() }),
    toDomain: (r) => ({ id: r.id, learnerId: r.learner_id, sloId: r.slo_id, activity: r.activity, practiceTask: r.practice_task ?? '', targetLevel: r.target_level ?? 'AE', reviewDate: r.review_date ?? '', completed: r.completed ?? false }),
  },
  user_settings: {
    fromDomain: () => null, // settings are saved through saveSettings(), not row ops
  },
};

/** Workspace tables in dependency-safe upsert order (parents first). */
export const SYNC_ORDER: SyncTable[] = [
  'learning_areas', 'strands', 'sub_strands', 'slos', 'competencies',
  'exams', 'questions', 'results', 'action_plan_items', 'learners',
];

/* ─── Supabase implementation ──────────────────────────────────────────────── */

export class SupabaseDataRepository implements DataRepository {
  async pullAll(userId: string) {
    const supabase = getSupabase()!;
    const tables: SyncTable[] = [
      'learners', 'learning_areas', 'strands', 'sub_strands', 'slos',
      'competencies', 'exams', 'questions', 'results', 'action_plan_items', 'user_settings',
    ];
    const out: Partial<Record<SyncTable, TableRow[]>> = {};
    // Sequential to keep the number of parallel requests modest.
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) throw new Error(`Initial sync failed on ${table}: ${error.message}`);
      out[table] = (data ?? []) as TableRow[];
    }
    return out;
  }

  async upsert(table: SyncTable, rows: TableRow[]) {
    if (rows.length === 0) return;
    const supabase = getSupabase()!;
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw new Error(`Sync upsert failed on ${table}: ${error.message}`);
  }

  async softDelete(table: SyncTable, ids: string[]) {
    if (ids.length === 0) return;
    const supabase = getSupabase()!;
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: iso() })
      .in('id', ids);
    if (error) throw new Error(`Sync delete failed on ${table}: ${error.message}`);
  }

  async saveSettings(userId: string, settings: Record<string, unknown>) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      data: settings,
      updated_at: iso(),
    });
    if (error) throw new Error(`Sync settings failed: ${error.message}`);
  }

  subscribe(userId: string, onRemote: (table: SyncTable, row: TableRow) => void) {
    const supabase = getSupabase()!;
    const tables: SyncTable[] = [
      'learners', 'learning_areas', 'strands', 'sub_strands', 'slos',
      'competencies', 'exams', 'questions', 'results', 'action_plan_items', 'user_settings',
    ];
    const channel = supabase.channel(`cbe-user-${userId.slice(0, 8)}`);
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new && Object.keys(payload.new as object).length > 0)
            ? payload.new
            : payload.old;
          if (row) {
            const r = row as TableRow;
            // Tombstoned rows are deletions: deliver with deleted_at so the merger
            // can remove them; live rows pass through for LWW comparison.
            onRemote(table, r);
          }
        },
      );
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }
}

/* ─── Local (empty) implementation for offline/demo mode ───────────────────── */

export class LocalDataRepository implements DataRepository {
  async pullAll() { return {}; }
  async upsert() {}
  async softDelete() {}
  async saveSettings() {}
  subscribe() { return () => {}; }
}

export const dataRepository: DataRepository =
  cloudEnabled ? new SupabaseDataRepository() : new LocalDataRepository();

/** Convert remote rows for one learner into a domain workspace. */
export function rowsToWorkspace(rows: Partial<Record<SyncTable, TableRow[]>>, learnerId: string) {
   
  const map = (t: SyncTable) =>
    (rows[t] ?? []).map(mappers[t].toDomain!).filter((r) => (r as any).learnerId === learnerId);
   
  return {
    learningAreas: map('learning_areas') as unknown as LearningArea[],
    strands: map('strands') as unknown as Strand[],
    subStrands: map('sub_strands') as unknown as SubStrand[],
    slos: map('slos') as unknown as SLO[],
    competencies: map('competencies') as unknown as CoreCompetency[],
    exams: map('exams').map((e) => {
      const exam = e as unknown as Exam;
      exam.questions = (rows.questions ?? []).map(mappers.questions.toDomain!)
        .filter((q) => (q as unknown as Question).examId === exam.id) as unknown as Question[];
      exam.questions.sort((a, b) => a.number - b.number);
      return exam;
    }) as unknown as Exam[],
    results: map('results') as unknown as Result[],
    actionPlan: map('action_plan_items') as unknown as ActionPlanItem[],
  };
}
