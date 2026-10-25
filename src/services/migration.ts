/**
 * Legacy data migration (REQ-MG1): converts the v1 single-learner localStorage /
 * IndexedDB document into an AccountDoc as the account's first learner.
 * - Downloads an automatic JSON backup FIRST (via the caller's progress hook).
 * - Retry-safe: keeps stable ids so re-running upserts does not duplicate.
 * - Idempotent: running it twice yields the same result.
 */
import type { AccountDoc } from '@/types';
import { downloadJSON } from '@/utils/export';

export type ImportStage = 'backup' | 'converting' | 'saving' | 'done' | 'error';

export interface ImportProgress {
  stage: ImportStage;
  done: boolean;
  error?: string;
}

type ProgressCb = (p: ImportProgress) => void;

const LEGACY_LEARNER_ID = 'learner-1'; // stable id ⇒ idempotent retried imports

export async function importLegacyState(
  legacy: import('@/types').AppState,
  doc: AccountDoc,
  /* accountId unused in the pure transform — kept for signature symmetry */
): Promise<AccountDoc>;
export async function importLegacyState(
  legacy: import('@/types').AppState,
  doc: AccountDoc,
  accountId: string,
  onProgress?: ProgressCb,
): Promise<AccountDoc>;
export async function importLegacyState(
  legacy: import('@/types').AppState,
  doc: AccountDoc,
  _accountId?: string,
  onProgress?: ProgressCb,
): Promise<AccountDoc> {
  onProgress?.({ stage: 'backup', done: false });
  const backupName = `cbe-backup-before-import-${new Date().toISOString().slice(0, 10)}.json`;
  downloadJSON(backupName, legacy);

  onProgress?.({ stage: 'converting', done: false });
  await new Promise((r) => setTimeout(r, 150)); // let the progress UI paint

  const learnerId = legacy.learner?.id ?? LEGACY_LEARNER_ID;
  const learner = {
    id: learnerId,
    name: legacy.learner?.name?.trim() || 'My Learner',
    grade: legacy.learner?.grade ?? 6,
    school: legacy.learner?.school ?? '',
    year: legacy.learner?.year ?? String(new Date().getFullYear()),
    colour: '#6366f1',
    archivedAt: null,
  };

  // Idempotency: never add the same learner twice (stable ids, matching equality).
  const existing = doc.learners.some((l) => l.id === learner.id);
  const learners = existing ? doc.learners : [...doc.learners, learner];

  const workspace = {
    learningAreas: legacy.learningAreas ?? [],
    strands: legacy.strands ?? [],
    subStrands: legacy.subStrands ?? [],
    slos: legacy.slos ?? [],
    competencies: legacy.competencies ?? [],
    exams: legacy.exams ?? [],
    results: legacy.results ?? [],
    actionPlan: legacy.actionPlan ?? [],
  };

  onProgress?.({ stage: 'saving', done: false });
  // Small delay so a progress bar transitions visibly for small datasets too
  await new Promise((r) => setTimeout(r, 150));

  return {
    ...doc,
    learners,
    activeLearnerId: learner.id,
    workspaces: { ...doc.workspaces, [learner.id]: workspace },
    settings: legacy.settings,
  };
}
