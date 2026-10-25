/**
 * Unit tests for the pure sync engine (REQ-T1): outbox ops, exponential
 * backoff and last-write-wins conflict resolution incl. soft-delete tombstones.
 */
import { describe, it, expect } from 'vitest';
import {
  applyRemoteRow, backoffDelay, makeOutboxEntry,
} from '@/services/syncEngine';
import type { OutboxEntry } from '@/services/syncEngine';

describe('backoffDelay (REQ-SY1 exponential backoff)', () => {
  it('doubles from 1s and caps at 60s', () => {
    expect(backoffDelay(0)).toBe(1_000);
    expect(backoffDelay(1)).toBe(2_000);
    expect(backoffDelay(2)).toBe(4_000);
    expect(backoffDelay(3)).toBe(8_000);
    expect(backoffDelay(6)).toBe(60_000); // 64s capped at the 60s ceiling
    expect(backoffDelay(20)).toBe(60_000); // capped
  });
});

describe('makeOutboxEntry', () => {
  it('creates unique, ordered entries', () => {
    const a: OutboxEntry = makeOutboxEntry({ kind: 'upsert', table: 'learners', row: { id: '1' } });
    const b = makeOutboxEntry({ kind: 'delete', table: 'exams', id: '2' });
    expect(a.id).not.toBe(b.id);
    expect(a.tries).toBe(0);
    expect(a.op.kind).toBe('upsert');
    expect(b.op.kind).toBe('delete');
  });
});

describe('applyRemoteRow — last-write-wins (REQ-SY2)', () => {
  interface Row { id: string; name?: string; updatedAt?: string | null; deletedAt?: string | null }

  it('adds a new remote row', () => {
    const { list, changed } = applyRemoteRow<Row>([], { id: 'a', updated_at: '2026-01-01T00:00:00Z' });
    expect(changed).toBe(true);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('a');
  });

  it('ignores a remote row older than the local copy', () => {
    const local: Row[] = [{ id: 'a', name: 'local-newer', updatedAt: '2026-01-02T00:00:00Z' }];
    const { list, changed } = applyRemoteRow(local, { id: 'a', updated_at: '2026-01-01T00:00:00Z' });
    expect(changed).toBe(false);
    expect(list[0].name).toBe('local-newer');
  });

  it('accepts a remote row newer than the local copy', () => {
    const local: Row[] = [{ id: 'a', name: 'old', updatedAt: '2026-01-01T00:00:00Z' }];
    const { list, changed } = applyRemoteRow(local, { id: 'a', name: 'new', updated_at: '2026-01-03T00:00:00Z' });
    expect(changed).toBe(true);
    expect(list[0].name).toBe('new');
  });

  it('removes the local row on a remote tombstone (soft delete)', () => {
    const local: Row[] = [{ id: 'a', updatedAt: '2026-01-01T00:00:00Z' }];
    const { list, changed } = applyRemoteRow(local, { id: 'a', deleted_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' });
    expect(changed).toBe(true);
    expect(list).toHaveLength(0);
  });

  it('ignores a tombstone for a row it has never seen', () => {
    const { list, changed } = applyRemoteRow<Row>([], { id: 'x', deleted_at: '2026-01-02T00:00:00Z' });
    expect(changed).toBe(false);
    expect(list).toHaveLength(0);
  });

  it('tombstone wins only when newer than the local copy', () => {
    const local: Row[] = [{ id: 'a', updatedAt: '2026-01-05T00:00:00Z' }];
    const { list, changed } = applyRemoteRow(local, { id: 'a', deleted_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    expect(changed).toBe(false);
    expect(list).toHaveLength(1);
  });
});
