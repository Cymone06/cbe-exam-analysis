/**
 * Export & import (REQ-EX1): JSON per learner or whole account (merge/replace),
 * CSV with the active learner's name, and generic file download helpers.
 */
import type { AppState, AccountDoc, Exam, Result, SLO, LearningArea, LearnerWorkspace, LearnerProfile } from '@/types';
import { downloadJson } from './download';

// ─── JSON backup ──────────────────────────────────────────────────────────────

const EXPORT_SCHEMA_VERSION = 2;

export interface WorkspaceExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  kind: 'learner';
  learner: LearnerProfile;
  data: LearnerWorkspace;
}

export interface AccountExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  kind: 'account';
  learners: LearnerProfile[];
  data: Record<string, LearnerWorkspace>;
  settings: AccountDoc['settings'];
}

export function exportLearnerJSON(state: AppState): void {
  const payload: WorkspaceExport = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    kind: 'learner',
    learner: state.learner as LearnerProfile,
    data: {
      learningAreas: state.learningAreas,
      strands: state.strands,
      subStrands: state.subStrands,
      slos: state.slos,
      competencies: state.competencies,
      exams: state.exams,
      results: state.results,
      actionPlan: state.actionPlan,
    },
  };
  downloadJson(`cbe-${slug(learnerName(payload.learner))}-${new Date().toISOString().slice(0, 10)}.json`, payload);
}

export function exportAccountJSON(accountDoc: AccountDoc): void {
  const payload: AccountExport = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    kind: 'account',
    learners: accountDoc.learners,
    data: accountDoc.workspaces,
    settings: accountDoc.settings,
  };
  downloadJson(`cbe-account-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
}

/** Generic JSON download used by data import and backup flows. */
export function downloadJSON(filename: string, data: unknown): void {
  downloadJson(filename, data);
}

function learnerName(learner: LearnerProfile | null | undefined): string {
  return learner?.name?.trim() || 'learner';
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'learner';
}

export type ImportMode = 'merge' | 'replace';

export interface ParsedImport {
  schemaVersion: number;
  kind: 'learner' | 'account' | 'legacy';
  learner?: LearnerProfile;
  learners?: LearnerProfile[];
  data: LearnerWorkspace | Record<string, LearnerWorkspace>;
  settings?: AccountDoc['settings'];
}

/** Structure validation for import (REQ-EX1). Throws a friendly message. */
export function parseImportFile(json: unknown): ParsedImport {
  if (!json || typeof json !== 'object') throw new Error('This file is not a CBE backup (expected a JSON object).');
  const obj = json as Record<string, unknown>;

  // Legacy v1 export ({ learner, learningAreas, ... })
  const hasLegacy = 'learningAreas' in obj && 'exams' in obj;
  if (hasLegacy) {
    return {
      schemaVersion: 1,
      kind: 'legacy',
      learner: obj.learner as LearnerProfile | undefined,
      data: obj as unknown as LearnerWorkspace,
      settings: obj.settings as AccountDoc['settings'] | undefined,
    };
  }
  const schemaVersion = Number(obj.schemaVersion ?? 0);
  if (schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new Error('Unsupported backup version — please use a backup exported from this app.');
  }
  if (obj.kind === 'learner') {
    const data = obj.data as LearnerWorkspace | undefined;
    if (!data?.learningAreas) throw new Error('This backup is missing the learner data.');
    return { schemaVersion, kind: 'learner', learner: obj.learner as LearnerProfile, data };
  }
  if (obj.kind === 'account') {
    const data = obj.data as Record<string, LearnerWorkspace> | undefined;
    if (!data) throw new Error('This backup is missing the account data.');
    return {
      schemaVersion,
      kind: 'account',
      learners: obj.learners as LearnerProfile[],
      data,
      settings: obj.settings as AccountDoc['settings'] | undefined,
    };
  }
  throw new Error('Unrecognised backup file kind.');
}

export interface WorkspaceImportResult {
  mode: ImportMode;
  next: LearnerWorkspace;
}

export function applyWorkspaceImport(
  mode: ImportMode,
  incoming: LearnerWorkspace,
  current: LearnerWorkspace,
): WorkspaceImportResult {
  if (mode === 'replace') return { mode, next: incoming };
  // Merge: stable ids — incoming rows win; current-only rows survive (no duplicates).
  const next: LearnerWorkspace = {
    learningAreas: mergeById(current.learningAreas, incoming.learningAreas),
    strands: mergeById(current.strands, incoming.strands),
    subStrands: mergeById(current.subStrands, incoming.subStrands),
    slos: mergeById(current.slos, incoming.slos),
    competencies: mergeById(current.competencies, incoming.competencies),
    exams: mergeById(current.exams, incoming.exams).map((e) => ({
      ...e,
      questions: mergeById(
        current.exams.find((c) => c.id === e.id)?.questions ?? [],
        incoming.exams.find((i) => i.id === e.id)?.questions ?? [],
      ),
    })),
    results: mergeById(current.results, incoming.results),
    actionPlan: mergeById(current.actionPlan, incoming.actionPlan),
  };
  return { mode, next };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>(current.map((r) => [r.id, r]));
  for (const r of incoming) map.set(r.id, r);
  return Array.from(map.values());
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function exportCSV(
  exams: Exam[],
  results: Result[],
  slos: SLO[],
  learningAreas: LearningArea[] = [],
  learnerName: string = '',
): void {
  const headers = [
    'Learner', 'Exam Title', 'Exam Type', 'Term', 'Date', 'Learning Area',
    'Q#', 'Max Marks', 'Marks Scored', 'Percentage',
    'SLO Code', 'SLO Description',
    'Cognitive Level', 'Error Type', 'Note',
  ];

  const areaName = (id: string) => learningAreas.find((la) => la.id === id)?.name ?? id;

  const rows: string[][] = [];

  for (const exam of exams) {
    for (const q of exam.questions) {
      const result = results.find((r) => r.questionId === q.id);
      const slo = slos.find((s) => s.id === q.sloId);
      const pct = result && q.maxMarks > 0
        ? ((result.marksScored / q.maxMarks) * 100).toFixed(1)
        : '';

      rows.push([
        learnerName,
        exam.title,
        exam.type,
        String(exam.term),
        exam.date,
        areaName(exam.learningAreaId),
        String(q.number),
        String(q.maxMarks),
        result ? String(result.marksScored) : '',
        pct,
        slo?.code ?? '',
        slo?.description ?? '',
        q.cognitiveLevel,
        result?.errorType ?? '',
        result?.note ?? '',
      ]);
    }
  }

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cbe-${slug(learnerName || 'learner')}-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bulk-add learners from a CSV file: name,grade,school,year (REQ-ML6 optional). */
export function parseLearnersCSV(text: string): { name: string; grade: number; school?: string; year?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('The CSV file is empty.');
  const first = lines[0].toLowerCase();
  let start = 0;
  const header = /name/.test(first) && /grade/.test(first);
  if (header) start = 1;
  const out: { name: string; grade: number; school?: string; year?: string }[] = [];
  for (const line of lines.slice(start)) {
    // Minimal CSV split (no quotes expected in this simple format)
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (!cols[0]) continue;
    const grade = Number(cols[1] ?? 6);
    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      throw new Error(`Row "${cols[0]}" has an invalid grade — grades are 1 to 12.`);
    }
    out.push({ name: cols[0], grade, school: cols[2] || undefined, year: cols[3] || undefined });
  }
  if (out.length === 0) throw new Error('No learners were found in the CSV file.');
  return out;
}
