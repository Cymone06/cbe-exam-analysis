/**
 * Unit tests for export/import (REQ-T1, REQ-EX1): schema validation,
 * merge/replace application and CSV bulk learner parsing.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseImportFile, applyWorkspaceImport, parseLearnersCSV,
  exportLearnerJSON, exportAccountJSON,
} from '@/utils/export';
import type { LearnerWorkspace } from '@/types';

function fakeWorkspace(): LearnerWorkspace {
  return {
    learningAreas: [{ id: 'la-1', name: 'Maths', colour: '#6366f1' }],
    strands: [], subStrands: [], slos: [], competencies: [],
    exams: [], results: [], actionPlan: [],
  };
}

describe('parseImportFile (import validation, REQ-EX1)', () => {
  it('accepts a v2 learner export', () => {
    const parsed = parseImportFile({
      schemaVersion: 2, kind: 'learner',
      learner: { id: 'l-1', name: 'Ama', grade: 6, school: '', year: '2026', colour: '#6366f1', archivedAt: null },
      data: fakeWorkspace(),
    });
    expect(parsed.kind).toBe('learner');
    expect(parsed.learner?.name).toBe('Ama');
  });

  it('accepts a v2 account export and keeps its workspaces keyed per learner', () => {
    const parsed = parseImportFile({
      schemaVersion: 2, kind: 'account',
      learners: [],
      data: { 'l-1': fakeWorkspace() },
      settings: { subLevelEnabled: false, thresholds: { EE: 75, ME: 50, AE: 25 }, theme: 'dark' },
    });
    expect(parsed.kind).toBe('account');
    expect((parsed.data as Record<string, LearnerWorkspace>)['l-1']).toBeTruthy();
  });

  it('accepts a legacy v1 flat export', () => {
    const parsed = parseImportFile({ learner: { id: 'll', name: 'Old', grade: 4, school: '', year: '2025' }, learningAreas: [], exams: [] });
    expect(parsed.kind).toBe('legacy');
  });

  it('rejects foreign JSON with a friendly message', () => {
    expect(() => parseImportFile({ hello: 'world' })).toThrow(/Unrecognised|backup/i);
    expect(() => parseImportFile(null)).toThrow(/not a CBE backup/i);
    expect(() => parseImportFile({ schemaVersion: 9, kind: 'learner' })).toThrow(/Unsupported backup version/i);
  });
});

describe('applyWorkspaceImport (merge vs replace, REQ-EX1)', () => {
  const current: LearnerWorkspace = {
    learningAreas: [{ id: 'la-1', name: 'Maths', colour: '#6366f1' }],
    strands: [], subStrands: [], slos: [], competencies: [],
    exams: [], results: [], actionPlan: [],
  };

  it('replace overwrites the workspace entirely', () => {
    const incoming = fakeWorkspace();
    incoming.learningAreas[0] = { id: 'la-9', name: 'Science', colour: '#fff' };
    const { next } = applyWorkspaceImport('replace', incoming, current);
    expect(next.learningAreas).toHaveLength(1);
    expect(next.learningAreas[0].id).toBe('la-9');
  });

  it('merge keeps current-only rows and does not duplicate shared ids', () => {
    const incoming: LearnerWorkspace = {
      learningAreas: [
        { id: 'la-1', name: 'Maths (renamed)', colour: '#6366f1' }, // same id → update
        { id: 'la-2', name: 'English', colour: '#0ea5e9' },          // new id → add
      ],
      strands: [], subStrands: [], slos: [], competencies: [], exams: [], results: [], actionPlan: [],
    };
    const { next } = applyWorkspaceImport('merge', incoming, current);
    expect(next.learningAreas).toHaveLength(2);
    expect(next.learningAreas.find((a) => a.id === 'la-1')?.name).toBe('Maths (renamed)');
    expect(next.learningAreas.find((a) => a.id === 'la-2')).toBeTruthy();
  });
});

describe('parseLearnersCSV (bulk add, REQ-ML6)', () => {
  it('parses rows with an optional header', () => {
    const rows = parseLearnersCSV('name,grade,school,year\nAma,5,Academy,2026\nKofi,6,,2026');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Ama', grade: 5, school: 'Academy', year: '2026' });
    expect(rows[1].school).toBeUndefined();
  });

  it('rejects invalid grades and empty files', () => {
    expect(() => parseLearnersCSV('Ama,0\n')).toThrow(/invalid grade/i);
    expect(() => parseLearnersCSV('   \n')).toThrow(/empty/i);
  });
});

describe('export helpers download named files with learner context', () => {
  it('learner export triggers a download without throwing', () => {
    const clicks: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      clicks.push('clicked');
    });
    const state = {
      learner: { id: 'l-1', name: 'Ama', grade: 6, school: '', year: '2026', colour: '#6366f1', archivedAt: null },
      learners: [], activeLearnerId: 'l-1', ...fakeWorkspace(),
      settings: { subLevelEnabled: false, thresholds: { EE: 75, ME: 50, AE: 25 }, theme: 'light' },
      seedDismissed: true,
    } as unknown as Parameters<typeof exportLearnerJSON>[0];
    expect(() => exportLearnerJSON(state)).not.toThrow();
    expect(clicks).toEqual(['clicked']);
    expect(typeof exportAccountJSON).toBe('function');
    clickSpy.mockRestore();
  });
});
