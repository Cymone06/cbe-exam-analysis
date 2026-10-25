/**
 * Local offline cache (REQ-SY1, REQ-SY3) — IndexedDB first, localStorage fallback.
 * v2: one document per account, namespaced by user id (`account:<uid>`, or
 * `account:local` for the signed-out mode), plus the per-account outbox for
 * pending sync changes. Cleared per-account on logout.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { AccountDoc, AppState } from '@/types';
import type { OutboxEntry } from '@/services/syncEngine';

const DB_NAME = 'cbe-exam-analysis';
const DB_VERSION = 2;
const ACCOUNT_STORE = 'accounts';
const OUTBOX_STORE = 'outbox';
/** v1 object store + key — kept only to migrate existing local data into the cloud account. */
export const LEGACY_STATE_KEY = 'state';
const LEGACY_STORE = 'appState';

let db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (db) return db;
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(ACCOUNT_STORE)) {
        database.createObjectStore(ACCOUNT_STORE);
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE);
      }
      // NOTE: a v1 database keeps the 'appState' store with the old 'state' key
      // untouched, so the "Import my existing data" migration can read it (REQ-MG1).
    },
  });
  return db;
}

/* ─── Account documents ────────────────────────────────────────────────────── */

/** The v1 state document, read once for the "Import my existing data" offer (REQ-MG1). */
export async function loadLegacyState(): Promise<AppState | null> {
  try {
    const database = await getDb();
    const legacy = (await database.get(ACCOUNT_STORE, 'legacy-state-v1')) as AppState | undefined;
    if (legacy) return legacy;
    // Databases created at v1 still hold the single-doc store.
    if (database.objectStoreNames.contains(LEGACY_STORE)) {
      return ((await database.get(LEGACY_STORE, LEGACY_STATE_KEY)) as AppState | undefined) ?? null;
    }
  } catch { /* ignore */ }
  const localKey = localStorage.getItem('cbe-app-state');
  if (localKey) {
    try { return JSON.parse(localKey) as AppState; } catch { /* ignore */ }
  }
  return null;
}

export async function loadAccountDoc(accountId: string): Promise<AccountDoc | null> {
  try {
    const database = await getDb();
    return ((await database.get(ACCOUNT_STORE, accountId)) as AccountDoc | undefined) ?? null;
  } catch (err) {
    console.warn('Account cache read failed', err);
    const raw = localStorage.getItem(`cbe-account:${accountId}`);
    return raw ? (JSON.parse(raw) as AccountDoc) : null;
  }
}

export async function saveAccountDoc(accountId: string, doc: AccountDoc): Promise<void> {
  try {
    const database = await getDb();
    await database.put(ACCOUNT_STORE, doc, accountId);
  } catch (err) {
    console.warn('Account cache write failed', err);
    try {
      localStorage.setItem(`cbe-account:${accountId}`, JSON.stringify(doc));
    } catch { /* storage full — the outbox still protects pending changes */ }
  }
}

/** Remove the account's cache and outbox (REQ-A7: logout clears local data). */
export async function clearAccount(accountId: string): Promise<void> {
  try {
    const database = await getDb();
    await database.delete(ACCOUNT_STORE, accountId);
    await database.delete(OUTBOX_STORE, accountId);
  } catch { /* ignore */ }
  localStorage.removeItem(`cbe-account:${accountId}`);
}

/* ─── Outbox (pending sync changes) ────────────────────────────────────────── */

export async function loadOutbox(accountId: string): Promise<OutboxEntry[]> {
  try {
    const database = await getDb();
    return ((await database.get(OUTBOX_STORE, accountId)) as OutboxEntry[] | undefined) ?? [];
  } catch { return []; }
}

export async function saveOutbox(accountId: string, entries: OutboxEntry[]): Promise<void> {
  try {
    const database = await getDb();
    await database.put(OUTBOX_STORE, entries, accountId);
  } catch {
    try { localStorage.setItem(`cbe-outbox:${accountId}`, JSON.stringify(entries)); } catch { /* ignore */ }
  }
}
