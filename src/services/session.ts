/**
 * Local session & identity (replaces Firebase Auth).
 *
 * The app is local-first: all data already lives in IndexedDB. Authentication only
 * existed to namespace documents per user (`userId`). That contract is preserved
 * here with a device-local identity, so:
 *   - every existing collection keeps working unchanged;
 *   - export/import across devices keeps working;
 *   - when you plug in a real backend later, only this file changes.
 *
 * There is deliberately NO password. A shared marketing site has no business holding
 * user credentials; when real accounts arrive they will come with the new database.
 */

const USER_KEY = 'libriwouo_user';
const SESSION_EVENT = 'libriwouo_session_changed';

export interface LocalUser {
  id: string;
  /** Free-text label shown in the UI. */
  name: string;
  email?: string;
  createdAt: string;
  /** Bumped when the app writes a breaking local-data change. */
  schemaVersion: number;
}

type SessionListener = (user: LocalUser | null) => void;

const listeners = new Set<SessionListener>();

function makeId(): string {
  const rand = Math.random().toString(36).slice(2, 11);
  return `usr_${Date.now().toString(36)}_${rand}`;
}

function read(): LocalUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string') return parsed as LocalUser;
  } catch {}
  return null;
}

function persist(user: LocalUser | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}

function emit(user: LocalUser | null): void {
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.warn('[Session] listener failed', e);
    }
  });
}

/** The current local user, or null. */
export function getCurrentUser(): LocalUser | null {
  return read();
}

/** Current user id, or '' when signed out. */
export function getUserId(): string {
  return read()?.id || '';
}

/** Subscribes to sign-in / sign-out. Returns an unsubscribe function. */
export function onSessionChange(cb: SessionListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Creates (or reuses) the local identity. Idempotent: calling it twice keeps the
 * same id so already-stored data stays attached.
 */
export function signInLocal(input: { name?: string; email?: string } = {}): LocalUser {
  const existing = read();
  if (existing) {
    // Keep the id; refresh the display fields.
    const next: LocalUser = {
      ...existing,
      name: input.name?.trim() || existing.name,
      email: input.email?.trim() || existing.email,
    };
    persist(next);
    emit(next);
    return next;
  }

  const user: LocalUser = {
    id: makeId(),
    name: input.name?.trim() || 'Entreprise locale',
    email: input.email?.trim() || undefined,
    createdAt: new Date().toISOString(),
    schemaVersion: 2,
  };
  persist(user);
  emit(user);
  return user;
}

/** Clears the local session. Data in IndexedDB is intentionally preserved. */
export function signOutLocal(): void {
  persist(null);
  emit(null);
}

/** Updates the display fields of the signed-in user. */
export function updateLocalUser(patch: Partial<Pick<LocalUser, 'name' | 'email'>>): LocalUser | null {
  const current = read();
  if (!current) return null;
  const next: LocalUser = { ...current, ...patch };
  persist(next);
  emit(next);
  return next;
}

/** Notifies cross-tab session changes (same contract as the old auth listener). */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === USER_KEY) emit(read());
  });
}

export const SESSION_CHANGED_EVENT = SESSION_EVENT;
