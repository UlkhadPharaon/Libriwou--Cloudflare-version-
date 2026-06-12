import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

type Listener = (data: any[]) => void;

// PBKDF2 + AES-GCM Client-Side Encryption
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 80000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(payload: string, passphrase: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(payload)
    );

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    // Convert combined binary buffer to Safe Base64
    let binary = '';
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.error("Encryption failed", err);
    throw new Error("Échec du chiffrement local. Veuillez vérifier vos clés.");
  }
}

export async function decryptData(encryptedBase64: string, passphrase: string): Promise<string> {
  try {
    const binaryString = window.atob(encryptedBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);

    const key = await deriveKey(passphrase, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed", err);
    throw new Error("Phrase de passe incorrecte. Impossible de déchiffrer les données.");
  }
}

class LocalDatabase {
  private listeners: Map<string, Set<Listener>> = new Map();
  private ramCache: Map<string, any[]> = new Map();
  private dbInstance: IDBDatabase | null = null;
  private isIndexedDbReady: boolean = false;
  private onReadyCallbacks: (() => void)[] = [];

  constructor() {
    this.initIndexedDB();
    this.requestPersistentStorage();
    
    // Multi-tab sync support
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('neocompta_local_sync_')) {
          const collection = e.key.replace('neocompta_local_sync_', '');
          this.loadFromIndexedDBToCache(collection).then(() => {
            this.notify(collection);
          });
        }
      });
    }
  }

  private initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn("IndexedDB not supported in this environment, falling back to localStorage");
      this.loadAllFromLocalStorage();
      return;
    }

    const request = window.indexedDB.open("NeoComptaLocalDB", 1);

    request.onerror = (e) => {
      console.error("IndexedDB blocked or failed to load. Falling back to localStorage.", e);
      this.loadAllFromLocalStorage();
    };

    request.onsuccess = (e: any) => {
      this.dbInstance = e.target.result;
      this.isIndexedDbReady = true;
      this.loadAllFromIndexedDB().then(() => {
        this.onReadyCallbacks.forEach(cb => cb());
        this.onReadyCallbacks = [];
      });
    };

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      const collections = ['transactions', 'inventory', 'stock_movements', 'companies'];
      collections.forEach(col => {
        if (!db.objectStoreNames.contains(col)) {
          db.createObjectStore(col, { keyPath: "id" });
        }
      });
    };
  }

  // Request high durability persistence from the browser
  private async requestPersistentStorage() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(isPersisted ? "🔒 Browser granted highly durable persistence" : "⚠️ Browser local storage is standard (non-persistent)");
      } catch (err) {
        console.warn("Failed to request persistent storage:", err);
      }
    }
  }

  public getIsPersistent(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return navigator.storage.persisted();
    }
    return Promise.resolve(false);
  }

  private async loadAllFromIndexedDB() {
    const collections = ['transactions', 'inventory', 'stock_movements', 'companies'];
    for (const col of collections) {
      await this.loadFromIndexedDBToCache(col);
    }
  }

  private loadFromIndexedDBToCache(collectionName: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.dbInstance) {
        resolve();
        return;
      }
      try {
        const transaction = this.dbInstance.transaction(collectionName, "readonly");
        const store = transaction.objectStore(collectionName);
        const req = store.getAll();

        req.onsuccess = () => {
          this.ramCache.set(collectionName, req.result || []);
          resolve();
        };

        req.onerror = () => {
          console.error(`Failed to load ${collectionName} from IndexedDB`);
          resolve();
        };
      } catch (err) {
        console.error(err);
        resolve();
      }
    });
  }

  private loadAllFromLocalStorage() {
    const collections = ['transactions', 'inventory', 'stock_movements', 'companies'];
    collections.forEach(col => {
      try {
        const key = `neocompta_local_${col}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          this.ramCache.set(col, JSON.parse(raw));
        } else {
          this.ramCache.set(col, []);
        }
      } catch (e) {
        this.ramCache.set(col, []);
      }
    });
  }

  public getAll(collection: string, userId?: string): any[] {
    const data = this.ramCache.get(collection) || [];
    if (userId) {
      return data.filter((item: any) => item.userId === userId || item.userId === undefined);
    }
    return data;
  }

  public get(collection: string, id: string): any | null {
    const list = this.getAll(collection);
    return list.find((item: any) => item.id === id) || null;
  }

  private async saveToIndexedDB(collectionName: string, id: string, item: any): Promise<void> {
    if (!this.dbInstance) {
      // Fallback to localStorage
      const current = this.ramCache.get(collectionName) || [];
      localStorage.setItem(`neocompta_local_${collectionName}`, JSON.stringify(current));
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.dbInstance!.transaction(collectionName, "readwrite");
        const store = tx.objectStore(collectionName);
        store.put(item);
        tx.oncomplete = () => resolve();
      } catch (err) {
        console.error("IndexedDB put error", err);
        resolve();
      }
    });
  }

  private async removeFromIndexedDB(collectionName: string, id: string): Promise<void> {
    if (!this.dbInstance) {
      const current = this.ramCache.get(collectionName) || [];
      localStorage.setItem(`neocompta_local_${collectionName}`, JSON.stringify(current));
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.dbInstance!.transaction(collectionName, "readwrite");
        const store = tx.objectStore(collectionName);
        store.delete(id);
        tx.oncomplete = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  public add(collection: string, item: any): string {
    const id = item.id || `local_${Math.random().toString(36).substring(2, 11)}`;
    const newItem = {
      ...item,
      id,
      createdAt: item.createdAt || new Date().toISOString()
    };
    
    const current = this.ramCache.get(collection) || [];
    current.push(newItem);
    this.ramCache.set(collection, current);
    
    this.saveToIndexedDB(collection, id, newItem).then(() => {
      this.notify(collection);
      // Notify other tabs
      try {
        localStorage.setItem(`neocompta_local_sync_${collection}`, Date.now().toString());
      } catch(_) {}
    });

    return id;
  }

  public update(collection: string, id: string, data: any): void {
    const current = this.ramCache.get(collection) || [];
    let updatedItem: any = null;
    const updated = current.map((item: any) => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    
    if (updatedItem) {
      this.ramCache.set(collection, updated);
      this.saveToIndexedDB(collection, id, updatedItem).then(() => {
        this.notify(collection);
        try {
          localStorage.setItem(`neocompta_local_sync_${collection}`, Date.now().toString());
        } catch(_) {}
      });
    }
  }

  public delete(collection: string, id: string): void {
    const current = this.ramCache.get(collection) || [];
    const filtered = current.filter((item: any) => item.id !== id);
    this.ramCache.set(collection, filtered);

    this.removeFromIndexedDB(collection, id).then(() => {
      this.notify(collection);
      try {
        localStorage.setItem(`neocompta_local_sync_${collection}`, Date.now().toString());
      } catch(_) {}
    });
  }

  public subscribe(collection: string, userId: string | undefined, callback: Listener): () => void {
    const key = `${collection}:${userId || 'global'}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    const set = this.listeners.get(key)!;
    set.add(callback);

    // Initial load callback
    const initialData = this.getAll(collection, userId);
    callback(initialData);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  private notify(collection: string): void {
    for (const [key, set] of this.listeners.entries()) {
      const [col, userId] = key.split(':');
      if (col === collection) {
        const data = this.getAll(collection, userId === 'global' ? undefined : userId);
        set.forEach(callback => {
          try {
            callback(data);
          } catch (e) {
            console.error("Error in localDb subscriber callback", e);
          }
        });
      }
    }
  }

  // --- Secure Multi-Device cloud sync (Zero-Knowledge) ---
  public async exportLocalPayload(userId: string): Promise<string> {
    const payload = {
      transactions: this.getAll('transactions', userId),
      inventory: this.getAll('inventory', userId),
      stock_movements: this.getAll('stock_movements', userId),
      companies: this.getAll('companies', userId)
    };
    return JSON.stringify(payload);
  }

  public async importLocalPayload(payloadString: string, userId: string): Promise<void> {
    try {
      const payload = JSON.parse(payloadString);
      const collections = ['transactions', 'inventory', 'stock_movements', 'companies'];
      
      for (const col of collections) {
        if (Array.isArray(payload[col])) {
          // Empty local collection
          const current = this.ramCache.get(col) || [];
          const preserved = current.filter((i: any) => i.userId !== userId);
          const newItems = payload[col].map((i: any) => ({ ...i, userId }));
          
          this.ramCache.set(col, [...preserved, ...newItems]);
          
          // Save to IndexedDB
          for (const item of newItems) {
            await this.saveToIndexedDB(col, item.id, item);
          }
          this.notify(col);
        }
      }
    } catch (e) {
      console.error(e);
      throw new Error("Format de données invalide");
    }
  }

  // Back up locally-encrypted data to Firebase Cloud Storage (Zero-Knowledge)
  public async uploadEncryptedCloudBackup(userId: string, passphrase: string): Promise<void> {
    const payloadText = await this.exportLocalPayload(userId);
    const encryptedText = await encryptData(payloadText, passphrase);
    
    await setDoc(doc(db, 'encrypted_fiscal_vaults', userId), {
      userId,
      ciphertext: encryptedText,
      updatedAt: new Date().toISOString(),
      integrity: "SHA256-AESGCM-ZK"
    });
  }

  // Restore and decrypt data from cloud
  public async restoreEncryptedCloudBackup(userId: string, passphrase: string): Promise<void> {
    const docRef = doc(db, 'encrypted_fiscal_vaults', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error("Aucun coffre-fort chiffré trouvé sur le cloud pour votre compte.");
    }
    const data = snap.data();
    const decryptedPayload = await decryptData(data.ciphertext, passphrase);
    await this.importLocalPayload(decryptedPayload, userId);
  }
}

export const localDb = new LocalDatabase();
