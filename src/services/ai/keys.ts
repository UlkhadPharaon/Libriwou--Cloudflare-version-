/**
 * Encrypted storage for user-supplied AI API keys (BYOK).
 *
 * Threat model, stated honestly:
 *  - The key is the USER's, entered at runtime, stored only on THIS device.
 *  - It is encrypted with an AES-GCM key generated with `extractable: false`.
 *    A non-extractable CryptoKey cannot be read back by JavaScript — an XSS
 *    payload can *use* it while the page is open, but cannot exfiltrate the raw
 *    key material, and cannot recover it from storage after the tab closes.
 *  - This is device-local protection, NOT a server secret. Never treat it as a
 *    substitute for a server-side key if you ever add a backend.
 *
 * Layout: a second IndexedDB (`LibriwouoKeyVault`) with two stores:
 *   `crypto_keys` -> the non-extractable AES-GCM key (id "device")
 *   `ai_keys`     -> { id: providerId, ciphertext: base64 }
 */

const DB_NAME = 'LibriwouoKeyVault';
const DB_VERSION = 1;
const KEY_STORE = 'crypto_keys';
const SECRET_STORE = 'ai_keys';
const KEY_ID = 'device';

let dbPromise: Promise<IDBDatabase> | null = null;

function openVault(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SECRET_STORE)) db.createObjectStore(SECRET_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('vault open failed'));
  });
  return dbPromise;
}

/** In-memory mirror so the UI never awaits IDB for reads. */
const memoryKeys = new Map<string, string>();

/** Returns the device key, creating it on first use. */
async function getDeviceKey(): Promise<CryptoKey> {
  const db = await openVault();

  const existing = await new Promise<CryptoKey | null>((resolve) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const req = tx.objectStore(KEY_STORE).get(KEY_ID);
    req.onsuccess = () => resolve((req.result?.key as CryptoKey) || null);
    req.onerror = () => resolve(null);
  });
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

  await new Promise<void>((resolve) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put({ id: KEY_ID, key, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });

  return key;
}

/**
 * Stores a key for `providerId`. An empty string deletes the entry.
 * Returns false only when WebCrypto/IndexedDB is genuinely unavailable.
 */
export async function setProviderKey(providerId: string, apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    memoryKeys.delete(providerId);
    try {
      const db = await openVault();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(SECRET_STORE, 'readwrite');
        tx.objectStore(SECRET_STORE).delete(providerId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
    return true;
  }

  try {
    const key = await getDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(trimmed));

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    for (const byte of combined) binary += String.fromCharCode(byte);
    const encoded = btoa(binary);

    const db = await openVault();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SECRET_STORE, 'readwrite');
      tx.objectStore(SECRET_STORE).put({ id: providerId, ciphertext: encoded, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    memoryKeys.set(providerId, trimmed);
    return true;
  } catch (error) {
    console.warn('[KeyVault] secure storage unavailable', error);
    return false;
  }
}

/** Reads the stored key, or '' when none. */
export async function getProviderKey(providerId: string): Promise<string> {
  const fromMemory = memoryKeys.get(providerId);
  if (fromMemory !== undefined) return fromMemory;

  try {
    const db = await openVault();
    const row = await new Promise<{ ciphertext?: string } | null>((resolve) => {
      const tx = db.transaction(SECRET_STORE, 'readonly');
      const req = tx.objectStore(SECRET_STORE).get(providerId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (!row?.ciphertext) {
      memoryKeys.set(providerId, '');
      return '';
    }

    const key = await getDeviceKey();
    const binary = atob(row.ciphertext);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    const value = new TextDecoder().decode(plain);
    memoryKeys.set(providerId, value);
    return value;
  } catch (error) {
    console.warn('[KeyVault] read failed', error);
    return '';
  }
}

/** Synchronous best-effort read (only works after a prior async load). */
export function peekProviderKey(providerId: string): string {
  return memoryKeys.get(providerId) || '';
}

/** Which providers currently have a stored key. */
export async function listConfiguredProviders(): Promise<string[]> {
  try {
    const db = await openVault();
    const rows = await new Promise<{ id: string }[]>((resolve) => {
      const tx = db.transaction(SECRET_STORE, 'readonly');
      const req = tx.objectStore(SECRET_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

/** Loads every stored key into memory. Call once at app start. */
export async function warmKeyVault(): Promise<void> {
  try {
    const db = await openVault();
    const rows = await new Promise<{ id: string; ciphertext: string }[]>((resolve) => {
      const tx = db.transaction(SECRET_STORE, 'readonly');
      const req = tx.objectStore(SECRET_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const key = await getDeviceKey();
    for (const row of rows) {
      try {
        const binary = atob(row.ciphertext);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
        memoryKeys.set(row.id, new TextDecoder().decode(plain));
      } catch {
        memoryKeys.set(row.id, '');
      }
    }
  } catch {
    /* vault not yet initialised — fine */
  }
}

/** Deletes every stored key (used by "reset AI configuration"). */
export async function wipeKeyVault(): Promise<void> {
  memoryKeys.clear();
  try {
    const db = await openVault();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([SECRET_STORE], 'readwrite');
      tx.objectStore(SECRET_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
