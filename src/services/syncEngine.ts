/**
 * Pure sync primitives (unit-testable): outbox ops, exponential backoff and
 * last-write-wins conflict resolution (REQ-SY2). Free of I/O and React.
 */
import type { SyncStatus } from '@/types';

export type SyncOp =
  | { kind: 'upsert'; table: string; row: Record<string, unknown> }
  | { kind: 'delete'; table: string; id: string };

export interface OutboxEntry {
  id: string;
  ts: number;
  tries: number;
  op: SyncOp;
}

let opSeq = 0;
export function makeOutboxEntry(op: SyncOp, ts = Date.now()): OutboxEntry {
  return { id: `ob-${ts}-${opSeq++}-${Math.random().toString(36).slice(2, 8)}`, ts, tries: 0, op };
}

/** Exponential backoff for the next flush attempt: 1s → 2s → … capped at 60s (REQ-SY1). */
export function backoffDelay(tries: number): number {
  return Math.min(60_000, 2 ** tries * 1000);
}

/**
 * Last-write-wins merge of a remote row into a local list (REQ-SY2):
 * - remote tombstone (deleted_at set) removes the local row
 * - remote row newer than local replaces it
 * - remote row older/equal than local is ignored
 * Returns the new local list (same reference if untouched).
 */
export function applyRemoteRow<T extends { id: string; deletedAt?: string | null; updatedAt?: string | null }>(
  local: T[],
  remote: { id: string; deleted_at?: string | null; updated_at?: string | null } & Record<string, unknown>,
): { list: T[]; changed: boolean } {
  const remoteTs = remote.updated_at ?? '';
  const desiredDeleted = Boolean(remote.deleted_at);

  const index = local.findIndex((r) => r.id === remote.id);
  if (index === -1) {
    if (desiredDeleted) return { list: local, changed: false };
    const mapped = { ...(remote as unknown as T), deletedAt: null, updatedAt: remoteTs };
    return { list: [...local, mapped], changed: true };
  }

  const existing = local[index];
  const localTs = existing.updatedAt ?? '';
  if (remoteTs && remoteTs <= localTs) return { list: local, changed: false };

  if (desiredDeleted) {
    const list = [...local];
    list.splice(index, 1);
    return { list, changed: true };
  }

  const list = [...local];
  list[index] = { ...(remote as unknown as T), deletedAt: null, updatedAt: remoteTs };
  return { list, changed: true };
}

/** Status transitions for the sync indicator (REQ-SY3). */
export function nextStatus(current: SyncStatus, action: 'online' | 'offline' | 'flushing' | 'flushed' | 'failed'): SyncStatus {
  switch (action) {
    case 'online': return current === 'error' ? 'error' : 'idle';
    case 'offline': return 'offline';
    case 'flushing': return 'syncing';
    case 'flushed': return 'synced';
    case 'failed': return 'error';
  }
}
