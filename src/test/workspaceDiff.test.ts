/**
 * Unit tests for workspaceDiff (REQ-SY1/REQ-T1): upserts for added/changed
 * rows, tombstones for removed rows, learner scoping stamped on every row.
 */
import { describe, it, expect } from 'vitest';
import { diffWorkspace } from '@/services/workspaceDiff';
import type { LearnerWorkspace, LearningArea, SLO } from '@/types';

function ws(partial: Partial<LearnerWorkspace>): LearnerWorkspace {
  return {
    learningAreas: [], strands: [], subStrands: [], slos: [],
    competencies: [], exams: [], results: [], actionPlan: [], ...partial,
  };
}

describe('diffWorkspace', () => {
  it('emits an upsert op for a new learning area with learner scoping', () => {
    const next = ws({ learningAreas: [{ id: 'la-1' as LearningArea['id'], name: 'Math', colour: '#333' } as LearningArea] });
    const ops = diffWorkspace(ws({}), next, 'learner-1', 'user-1');
    const la = ops.find((o) => o.kind === 'upsert' && o.table === 'learning_areas');
    expect(la).toBeTruthy();
    if (la?.kind === 'upsert') {
      expect(la.row.user_id).toBe('user-1');
      expect(la.row.learner_id).toBe('learner-1');
      expect(la.row.id).toBe('la-1');
    }
  });

  it('emits a delete (tombstone) op for a removed row', () => {
    const before = ws({ slos: [{ id: 'slo-1', subStrandId: 'ss-1', code: '6.1', description: 'x', weight: 1 } as SLO] });
    const ops = diffWorkspace(before, ws({}), 'learner-1', 'user-1');
    expect(ops).toContainEqual({ kind: 'delete', table: 'slos', id: 'slo-1' });
  });

  it('emits nothing when nothing changed', () => {
    const same = ws({ learningAreas: [{ id: 'la-1' as LearningArea['id'], name: 'Math', colour: '#333' } as LearningArea] });
    expect(diffWorkspace(same, same, 'learner-1', 'user-1')).toHaveLength(0);
  });

  it('returns no ops without an active learner', () => {
    expect(diffWorkspace(ws({}), ws({}), '', 'user-1')).toHaveLength(0);
  });

  it('flattens question changes from nested exams', () => {
    const before = ws({
      exams: [{
        id: 'e-1', title: 'T', type: 'CAT', term: 1, date: '2026-01-01', learningAreaId: 'la-1',
        questions: [{ id: 'q-1', examId: 'e-1', number: 1, maxMarks: 5, sloId: 's-1', performanceIndicator: '', cognitiveLevel: 'Recall', competencyIds: [] }],
      }],
    });
    const after = ws({
      exams: [{
        id: 'e-1', title: 'T', type: 'CAT', term: 1, date: '2026-01-01', learningAreaId: 'la-1',
        questions: [
          { id: 'q-1', examId: 'e-1', number: 1, maxMarks: 5, sloId: 's-1', performanceIndicator: '', cognitiveLevel: 'Recall', competencyIds: [] },
          { id: 'q-2', examId: 'e-1', number: 2, maxMarks: 10, sloId: 's-1', performanceIndicator: '', cognitiveLevel: 'Application', competencyIds: [] },
        ],
      }],
    });
    const ops = diffWorkspace(before, after, 'learner-1', 'user-1');
    expect(ops.some((o) => o.kind === 'upsert' && o.table === 'questions')).toBe(true);
  });
});
