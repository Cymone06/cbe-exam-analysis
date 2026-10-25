/**
 * SyncManager — the online/offline sync loop (REQ-SY1..SY3).
 * Persists the outbox per account, flushes when online with exponential
 * backoff retries, and applies remote realtime rows with last-write-wins.
 */
import type { LearnerWorkspace, SyncStatus } from '@/types';
import {
  dataRepository, mappers, type SyncTable, type TableRow,
} from '@/services/dataRepository';
import {
  applyRemoteRow, backoffDelay, makeOutboxEntry,
  type OutboxEntry, type SyncOp,
} from '@/services/syncEngine';
import {
  loadOutbox, saveOutbox, loadAccountDoc, saveAccountDoc, clearAccount,
} from '@/store/db';

export interface SyncInfo {
  status: SyncStatus;
  pending: number;
  lastError: string | null;
}

type StatusListener = (info: SyncInfo) => void;

/** Remote row shape expected by the LWW engine (snake_case from Postgres). */
type RemoteRow = { id: string; deleted_at?: string | null; updated_at?: string | null };
const asRemote = (row: TableRow): RemoteRow => row as unknown as RemoteRow;

export class SyncManager {
  readonly accountId: string;
  private outbox: OutboxEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private disposed = false;
  private onStatus: StatusListener;
  /** Called when a remote row arrives so the AppContext can apply it live. */
  remoteListener: ((table: SyncTable, row: TableRow) => void) | null = null;
  unsubscribeRealtime: (() => void) | null = null;

  constructor(accountId: string, onStatus: StatusListener) {
    this.accountId = accountId;
    this.onStatus = onStatus;
    window.addEventListener('online', this.handleOnlineOffline);
    window.addEventListener('offline', this.handleOnlineOffline);
    void this.boot();
  }

  private async boot() {
    this.outbox = await loadOutbox(this.accountId);
    this.handleOnlineOffline();
  }

  private handleOnlineOffline = () => {
    if (this.disposed) return;
    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }
    if (this.outbox.length > 0) {
      void this.flush();
    } else {
      this.setStatus('idle');
    }
  };

  /** Queue pending changes (called on every local commit while signed in). */
  async enqueue(ops: SyncOp[]) {
    if (ops.length === 0) return;
    this.outbox = [...this.outbox, ...ops.map((op) => makeOutboxEntry(op))];
    await saveOutbox(this.accountId, this.outbox);
    this.onStatus({ status: this.flushing ? 'syncing' : navigator.onLine ? 'synced' : 'offline', pending: this.outbox.length, lastError: null });
    if (navigator.onLine) void this.flush();
    else this.setStatus('offline');
  }

  /** Manual retry from the "Sync error (retry)" indicator. */
  retryNow() {
    this.setStatus('syncing');
    void this.flush();
  }

  pendingCount() { return this.outbox.length; }

  private setStatus(status: SyncStatus) {
    this.onStatus({ status, pending: this.outbox.length, lastError: this.lastError });
  }

  private lastError: string | null = null;

  private async flush() {
    if (this.flushing || this.disposed || !navigator.onLine) return;
    this.flushing = true;
    this.setStatus('syncing');
    const batch = [...this.outbox];
    try {
      for (const entry of batch) {
        if (entry.op.kind === 'upsert') {
          await dataRepository.upsert(entry.op.table as SyncTable, [entry.op.row]);
        } else {
          await dataRepository.softDelete(entry.op.table as SyncTable, [entry.op.id]);
        }
        this.outbox = this.outbox.filter((e) => e.id !== entry.id);
        await saveOutbox(this.accountId, this.outbox);
      }
      this.lastError = null;
      this.flushing = false;
      this.setStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (err) {
      this.flushing = false;
      this.lastError = err instanceof Error ? err.message : 'Sync failed';
      // bump tries on every entry that was attempted
      const tried = new Set(batch.map((e) => e.id));
      this.outbox = this.outbox.map((e) => (tried.has(e.id) ? { ...e, tries: e.tries + 1 } : e));
      await saveOutbox(this.accountId, this.outbox);
      this.setStatus('error');
      const delay = backoffDelay(Math.min(...this.outbox.map((e) => e.tries)));
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), delay);
    }
  }

  /** Subscribe to remote changes and start streaming into the app (returns cleanup). */
  startRealtime(userId: string) {
    if (this.unsubscribeRealtime) this.unsubscribeRealtime();
    this.unsubscribeRealtime = dataRepository.subscribe(userId, (table, row) => {
      void this.applyRemote(table, row);
      this.remoteListener?.(table, row);
    });
  }

  /**
   * Merge a remote row into the cached account doc with LWW + tombstones so
   * changes made on another device appear (reducer applies live rows itself).
   */
  async applyRemote(table: SyncTable, row: TableRow) {
    try {
      if (table === 'user_settings') return; // handled by the reducer listener
      const doc = await loadAccountDoc(this.accountId);
      if (!doc) return;
      const domain = mappers[table]?.toDomain?.(row) as Record<string, unknown> | undefined;
      if (!domain) return;
      const learnerId = domain.learnerId as string | undefined;
      if (table === 'learners') {
        const result = applyRemoteRow(doc.learners as unknown as { id: string; deletedAt?: string | null; updatedAt?: string | null }[], asRemote(row));
        if (result.changed) {
          await saveAccountDoc(this.accountId, { ...doc, learners: result.list as typeof doc.learners });
        }
        return;
      }
      if (!learnerId) return;
      const workspace = doc.workspaces[learnerId];
      if (!workspace) return;
      const key = tableKey(table);
      if (table === 'questions') {
        // Questions are nested inside exams — merge into the parent exam.
        const examId = row.exam_id as string | undefined;
        if (!examId) return;
        const ws = { ...doc.workspaces[learnerId] };
        // Find which learner workspace holds the exam (same learner normally).
        const exam = ws.exams.find((e) => e.id === examId);
        if (!exam) return;
        let changed = false;
        const questions = exam.questions.map((q) => ({ ...q, updatedAt: null, deletedAt: null }));
        const merged = applyRemoteRow(
          questions as unknown as { id: string; deletedAt?: string | null; updatedAt?: string | null }[],
          asRemote(row),
        );
        if (merged.changed) {
          exam.questions = (merged.list as unknown as typeof questions)
            .filter((q) => !q.deletedAt)
            .sort((a, b) => a.number - b.number) as typeof exam.questions;
          changed = true;
        }
        if (changed) {
          await saveAccountDoc(this.accountId, {
            ...doc,
            workspaces: { ...doc.workspaces, [learnerId]: ws },
          });
        }
        return;
      }
      if (!key) return;
      const current = workspace as unknown as Record<string, { id: string; deletedAt?: string | null; updatedAt?: string | null }[]>;
      const result = applyRemoteRow(current[key] ?? [], asRemote(row));
      if (result.changed) {
        await saveAccountDoc(this.accountId, {
          ...doc,
          workspaces: { ...doc.workspaces, [learnerId]: { ...workspace, [key]: result.list } as unknown as LearnerWorkspace },
        });
      }
    } catch { /* a failed remote merge must not break the app; the next pull heals it */ }
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener('online', this.handleOnlineOffline);
    window.removeEventListener('offline', this.handleOnlineOffline);
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
  }
}

function tableKey(table: SyncTable): string | null {
  const map: Partial<Record<SyncTable, string>> = {
    learning_areas: 'learningAreas',
    strands: 'strands',
    sub_strands: 'subStrands',
    slos: 'slos',
    competencies: 'competencies',
    exams: 'exams',
    results: 'results',
    action_plan_items: 'actionPlan',
  };
  return map[table] ?? null;
}

/** Convenience: clear everything for an account on logout (REQ-A7). */
export async function logoutCleanup(accountId: string) {
  await clearAccount(accountId);
}

export type { OutboxEntry };
