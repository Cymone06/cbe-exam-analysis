/**
 * workspaceDiff — computes the outbox operations between two workspaces.
 * Pure and unit-testable (REQ-SY1, REQ-SY2: upserts, soft-delete tombstones).
 * Rows are stamped with the account user and the active learner.
 */
import type {
  LearnerWorkspace, LearningArea, Strand, SubStrand, SLO, CoreCompetency,
  Exam, Question, Result, ActionPlanItem,
} from '@/types';
import { mappers, type SyncTable } from '@/services/dataRepository';
import type { SyncOp } from '@/services/syncEngine';

 

function diffArray<T extends { id: string }>(
  table: SyncTable,
  prevEntities: T[],
  nextEntities: T[],
  userId: string | undefined,
  learnerId: string,
): SyncOp[] {
  const ops: SyncOp[] = [];
  const prevById = new Map(prevEntities.map((r) => [r.id, r]));
  const nextById = new Map(nextEntities.map((r) => [r.id, r]));

  // Upserts: added or changed rows
  for (const next of nextEntities) {
    const before = prevById.get(next.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(next)) {
      const row = mappers[table].fromDomain(next as unknown as Record<string, unknown>);
      if (!row) continue;
      ops.push({
        kind: 'upsert',
        table,
        row: { ...row, user_id: userId, learner_id: learnerId },
      });
    }
  }
  // Tombstones: rows removed since the previous workspace
  for (const before of prevEntities) {
    if (!nextById.has(before.id)) {
      ops.push({ kind: 'delete', table, id: before.id });
    }
  }
  return ops;
}

function flatQuestions(exams: Exam[]): Question[] {
  return exams.flatMap((e) => e.questions);
}

/** Diff the whole active-learner workspace → cloud ops (parents before children). */
export function diffWorkspace(
  prev: LearnerWorkspace,
  next: LearnerWorkspace,
  activeLearnerId: string,
  userId?: string,
): SyncOp[] {
  if (!activeLearnerId) return [];
  const ops: SyncOp[] = [
    ...diffArray<LearningArea>('learning_areas', prev.learningAreas, next.learningAreas, userId, activeLearnerId),
    ...diffArray<Strand>('strands', prev.strands, next.strands, userId, activeLearnerId),
    ...diffArray<SubStrand>('sub_strands', prev.subStrands, next.subStrands, userId, activeLearnerId),
    ...diffArray<SLO>('slos', prev.slos, next.slos, userId, activeLearnerId),
    ...diffArray<CoreCompetency>('competencies', prev.competencies, next.competencies, userId, activeLearnerId),
    ...diffArray<Exam>('exams', prev.exams, next.exams, userId, activeLearnerId),
    ...diffArray<Question>('questions', flatQuestions(prev.exams), flatQuestions(next.exams), userId, activeLearnerId),
    ...diffArray<Result>('results', prev.results, next.results, userId, activeLearnerId),
    ...diffArray<ActionPlanItem>('action_plan_items', prev.actionPlan, next.actionPlan, userId, activeLearnerId),
  ];
  return ops;
}
