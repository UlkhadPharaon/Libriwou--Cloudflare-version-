/**
 * Data repository — the single seam for persistence.
 *
 * Before: pages read IndexedDB for the UI and mirrored every write to Firestore.
 * After: everything goes through `repo`, which today is IndexedDB only.
 *
 * When the real backend arrives, implement `RemoteAdapter` and pass it to
 * `setRemoteAdapter()`. `localDb` stays the source of truth for offline reads;
 * the adapter is fired in the background and never blocks a write.
 *
 *   interface RemoteAdapter {
 *     push(collection: string, doc: StoredDoc): Promise<void>;
 *     remove(collection: string, id: string): Promise<void>;
 *     pull(collection: string, userId: string): Promise<StoredDoc[]>;
 *   }
 */

import { localDb } from './localDb';
import { getUserId } from './session';

export interface StoredDoc {
  id: string;
  userId?: string;
  [key: string]: unknown;
}

export interface RemoteAdapter {
  name: string;
  /** Called after a successful local write. Must not throw. */
  push(collection: string, doc: StoredDoc): Promise<void>;
  /** Called after a successful local delete. Must not throw. */
  remove(collection: string, id: string): Promise<void>;
  /** Called once at startup to reconcile. May return [] when offline. */
  pull(collection: string, userId: string): Promise<StoredDoc[]>;
}

let adapter: RemoteAdapter | null = null;

/** Registers a backend. Returns a disposer that restores local-only mode. */
export function setRemoteAdapter(next: RemoteAdapter | null): () => void {
  adapter = next;
  console.log(`[repo] remote adapter ${next ? `enabled: ${next.name}` : 'disabled (local-only)'}`);
  return () => setRemoteAdapter(null);
}

export function getRemoteAdapter(): RemoteAdapter | null {
  return adapter;
}

/** Fires the remote write in the background; a failure never breaks the UI. */
function mirror(operation: () => Promise<void>, what: string): void {
  void (async () => {
    try {
      await operation();
    } catch (error) {
      console.warn(`[repo] remote ${what} failed (local copy kept):`, error);
    }
  })();
}

// ---------------------------------------------------------------------------
// Public API — used by every page
// ---------------------------------------------------------------------------

export interface SubscribeOptions {
  /** When false, returns every row regardless of owner (admin views). */
  scoped?: boolean;
}

/** Live subscription. Same semantics as the old Firestore `onSnapshot`. */
export function subscribe<T>(
  collection: string,
  callback: (rows: T[]) => void,
  options: SubscribeOptions = {}
): () => void {
  const scoped = options.scoped !== false;
  const userId = scoped ? getUserId() : undefined;
  return localDb.subscribe(collection, userId, (rows) => callback(rows as T[]));
}

export function list<T>(collection: string, options: SubscribeOptions = {}): T[] {
  const scoped = options.scoped !== false;
  const userId = scoped ? getUserId() : undefined;
  return localDb.getAll(collection, userId) as T[];
}

export function find<T>(collection: string, id: string): T | null {
  return localDb.get(collection, id) as T | null;
}

/** Creates a row locally and mirrors it to the backend. */
export function create<T extends StoredDoc>(collection: string, item: T): string {
  const id = localDb.add(collection, { ...item, userId: item.userId ?? getUserId() });
  const stored = find<StoredDoc>(collection, id) ?? ({ ...item, id } as StoredDoc);
  mirror(() => adapter!.push(collection, stored), 'create');
  return id;
}

/** Patches a row locally and mirrors it. */
export function update<T extends StoredDoc>(collection: string, id: string, patch: Partial<T>): void {
  localDb.update(collection, id, patch);
  const stored = find<StoredDoc>(collection, id);
  if (stored) mirror(() => adapter!.push(collection, stored), 'update');
}

export function remove(collection: string, id: string): void {
  localDb.delete(collection, id);
  mirror(() => adapter!.remove(collection, id), 'delete');
}

/** Bulk create, mirroring each row. */
export function createMany<T extends StoredDoc>(collection: string, items: T[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(localDb.add(collection, { ...item, userId: item.userId ?? getUserId() }));
  }
  for (const id of ids) {
    const stored = find<StoredDoc>(collection, id);
    if (stored) mirror(() => adapter!.push(collection, stored), 'create');
  }
  return ids;
}

/**
 * Startup reconciliation. Kept as a no-op while there is no backend so that
 * enabling one later is a one-line change.
 */
export async function syncFromRemote(collection: string): Promise<number> {
  if (!adapter) return 0;
  const userId = getUserId();
  if (!userId) return 0;

  const remote = await adapter.pull(collection, userId);
  let applied = 0;

  for (const doc of remote) {
    const local = find<StoredDoc>(collection, doc.id);
    if (!local) {
      localDb.add(collection, { ...doc, id: doc.id, userId });
      applied += 1;
      continue;
    }
    // Last-write-wins on updatedAt; ties keep the local copy.
    const remoteTs = typeof doc.updatedAt === 'string' ? Date.parse(doc.updatedAt) : 0;
    const localTs = typeof local.updatedAt === 'string' ? Date.parse(local.updatedAt) : 0;
    if (Number.isFinite(remoteTs) && remoteTs > localTs) {
      localDb.update(collection, doc.id, doc);
      applied += 1;
    }
  }
  return applied;
}

export const repo = {
  subscribe,
  list,
  find,
  create,
  createMany,
  update,
  remove,
  syncFromRemote,
};
