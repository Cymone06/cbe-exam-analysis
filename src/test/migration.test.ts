/**
 * Unit tests for the legacy data migration (REQ-T1, REQ-MG1): the import must
 * be idempotent (stable ids ⇒ no duplicate learners on retry) and must keep
 * every legacy row keyed to the first learner.
 */
import { describe, it, expect } from 'vitest';
import { importLegacyState } from '@/services/migration';
import { INITIAL_STATE } from '@/store/AppContext';
import type { AccountDoc, AppState, LearnerProfile } from '@/types';

function legacyState(): AppState {
  return {
    ...INITIAL_STATE,
    learner: { id: 'legacy-learner', name: 'Ama Legacy', grade: 5, school: 'Academy', year: '2025' },
    learningAreas: [{ id: 'la-1', name: 'Maths', colour: '#6366f1' }],
    exams: [{
      id: 'e-1', title: 'Quiz', type: 'CAT', term: 1, date: '2025-06-01', learningAreaId: 'la-1',
      questions: [{ id: 'q-1', examId: 'e-1', number: 1, maxMarks: 5, sloId: 'slo-1', performanceIndicator: '', cognitiveLevel: 'Recall', competencyIds: [] }],
    }],
    results: [{ id: 'r-1', examId: 'e-1', questionId: 'q-1', marksScored: 4 }],
    competencies: [],
  };
}

function emptyDoc(): AccountDoc {
  return {
    learners: [], activeLearnerId: null,
    workspaces: {},
    settings: INITIAL_STATE.settings,
  };
}

describe('importLegacyState (REQ-MG1)', () => {
  it('makes the legacy data the account\'s first learner', async () => {
    const doc = await importLegacyState(legacyState(), emptyDoc());
    expect(doc.learners).toHaveLength(1);
    expect(doc.learners[0]).toMatchObject({ id: 'legacy-learner', name: 'Ama Legacy' });
    expect(doc.activeLearnerId).toBe('legacy-learner');
    const ws = doc.workspaces['legacy-learner'];
    expect(ws.exams).toHaveLength(1);
    expect(ws.results).toHaveLength(1);
    expect(ws.learningAreas[0].id).toBe('la-1');
  });

  it('is idempotent — running twice creates no duplicate learner', async () => {
    const first = await importLegacyState(legacyState(), emptyDoc());
    const second = await importLegacyState(legacyState(), first);
    const profiles = second.learners.filter((l: LearnerProfile) => l.id === 'legacy-learner');
    expect(second.learners).toHaveLength(1);
    expect(profiles).toHaveLength(1);
    // Stable ids: workspace rows reuse the same ids every time (retry-safe upserts)
    expect(second.workspaces['legacy-learner'].exams[0].id).toBe('e-1');
  });

  it('keeps the legacy settings', async () => {
    const legacy = { ...legacyState(), settings: { ...INITIAL_STATE.settings, theme: 'dark' as const } };
    const doc = await importLegacyState(legacy, emptyDoc());
    expect(doc.settings.theme).toBe('dark');
  });

  it('falls back when the legacy learner profile is missing', async () => {
    const noLearner = { ...legacyState(), learner: null };
    const doc = await importLegacyState(noLearner, emptyDoc());
    expect(doc.learners[0].name).toBe('My Learner');
  });
});
