/**
 * Unit tests for the local cache (REQ-SY1, REQ-SY3, REQ-ML4): per-account
 * namespacing, outbox persistence, and clearing on logout — learner scoping
 * at the storage layer means no cache leakage between accounts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAccountDoc, saveAccountDoc, clearAccount, loadOutbox, saveOutbox, loadLegacyState,
} from '@/store/db';
import { INITIAL_STATE } from '@/store/AppContext';
import type { AccountDoc } from '@/types';

function doc(learnerId: string): AccountDoc {
  return {
    learners: [{ id: learnerId, name: 'Ama', grade: 6, school: '', year: '2026', colour: '#6366f1', archivedAt: null }],
    activeLearnerId: learnerId,
    workspaces: {
      [learnerId]: {
        learningAreas: [], strands: [], subStrands: [], slos: [],
        competencies: [], exams: [], results: [], actionPlan: [],
      },
    },
    settings: INITIAL_STATE.settings,
  };
}

describe('account cache (namespaced per user)', () => {
  beforeEach(async () => {
    // fresh fake-indexeddb per test (setup.ts swaps the factory)
  });

  it('saves and loads a document under its own account key', async () => {
    await saveAccountDoc('user-A', doc('l-1'));
    const loaded = await loadAccountDoc('user-A');
    expect(loaded?.learners[0].name).toBe('Ama');
    expect(loaded?.activeLearnerId).toBe('l-1');
  });

  it('does not leak data between accounts (learner scoping REQ-ML4)', async () => {
    await saveAccountDoc('user-A', doc('l-1'));
    const b = await loadAccountDoc('user-B');
    expect(b).toBeNull();
    clearAccount('user-A');
  });

  it('clearAccount removes the cache and outbox (logout REQ-A7)', async () => {
    await saveAccountDoc('user-A', doc('l-1'));
    await saveOutbox('user-A', [{ id: 'ob-1', ts: 1, tries: 0, op: { kind: 'upsert', table: 'learners', row: { id: '1' } } }]);
    await clearAccount('user-A');
    expect(await loadAccountDoc('user-A')).toBeNull();
    expect(await loadOutbox('user-A')).toEqual([]);
  });

  it('persists and loads the outbox per account', async () => {
    const entries = [{ id: 'ob-x', ts: 42, tries: 2, op: { kind: 'delete' as const, table: 'exams', id: 'e-1' } }];
    await saveOutbox('user-C', entries);
    expect(await loadOutbox('user-C')).toEqual(entries);
    await clearAccount('user-C');
  });

  it('returns null (not a throw) when nothing was ever saved', async () => {
    expect(await loadLegacyState()).toBeNull();
  });
});
