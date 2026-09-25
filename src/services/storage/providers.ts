import type { SaveMeta, SaveRecord, StorageProvider } from './types';

/** Flüchtiger Speicher (Tests, private Fenster ohne Speicherzugriff). */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'Arbeitsspeicher';
  private records = new Map<string, string>();

  async list(): Promise<SaveMeta[]> {
    return [...this.records.values()].map((raw) => (JSON.parse(raw) as SaveRecord).meta);
  }

  async load(slotId: string): Promise<SaveRecord | null> {
    const raw = this.records.get(slotId);
    return raw ? (JSON.parse(raw) as SaveRecord) : null;
  }

  async save(record: SaveRecord): Promise<void> {
    this.records.set(record.meta.slotId, JSON.stringify(record));
  }

  async remove(slotId: string): Promise<void> {
    this.records.delete(slotId);
  }
}

const LS_PREFIX = 'tech-empire:save:';
const LS_INDEX = 'tech-empire:save-index';

/** LocalStorage-Backend (Fallback, ca. 5 MB Limit). */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'LocalStorage';
  constructor(private storage: Storage) {}

  private readIndex(): SaveMeta[] {
    try {
      return JSON.parse(this.storage.getItem(LS_INDEX) ?? '[]') as SaveMeta[];
    } catch {
      return [];
    }
  }

  private writeIndex(index: SaveMeta[]): void {
    this.storage.setItem(LS_INDEX, JSON.stringify(index));
  }

  async list(): Promise<SaveMeta[]> {
    return this.readIndex();
  }

  async load(slotId: string): Promise<SaveRecord | null> {
    const raw = this.storage.getItem(LS_PREFIX + slotId);
    return raw ? (JSON.parse(raw) as SaveRecord) : null;
  }

  async save(record: SaveRecord): Promise<void> {
    try {
      this.storage.setItem(LS_PREFIX + record.meta.slotId, JSON.stringify(record));
    } catch (error) {
      throw new Error(`Speichern fehlgeschlagen – der Browser-Speicher ist voll (${(error as Error).message}).`, { cause: error });
    }
    const index = this.readIndex().filter((m) => m.slotId !== record.meta.slotId);
    index.push(record.meta);
    this.writeIndex(index);
  }

  async remove(slotId: string): Promise<void> {
    this.storage.removeItem(LS_PREFIX + slotId);
    this.writeIndex(this.readIndex().filter((m) => m.slotId !== slotId));
  }
}

const DB_NAME = 'tech-empire';
const DB_VERSION = 1;
const STATE_STORE = 'saves';
const META_STORE = 'meta';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
  });
}

/** IndexedDB-Backend: große Spielstände, getrennte Metadaten für schnelle Listen. */
export class IndexedDbStorageProvider implements StorageProvider {
  readonly name = 'IndexedDB';
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private factory: IDBFactory) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.factory.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
          if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden'));
      });
    }
    return this.dbPromise;
  }

  async list(): Promise<SaveMeta[]> {
    const db = await this.db();
    const tx = db.transaction(META_STORE, 'readonly');
    return promisify(tx.objectStore(META_STORE).getAll() as IDBRequest<SaveMeta[]>);
  }

  async load(slotId: string): Promise<SaveRecord | null> {
    const db = await this.db();
    const tx = db.transaction([STATE_STORE, META_STORE], 'readonly');
    const [state, meta] = await Promise.all([
      promisify(tx.objectStore(STATE_STORE).get(slotId)),
      promisify(tx.objectStore(META_STORE).get(slotId)),
    ]);
    if (!state || !meta) return null;
    return { meta: meta as SaveMeta, state: state as SaveRecord['state'] };
  }

  async save(record: SaveRecord): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([STATE_STORE, META_STORE], 'readwrite');
    tx.objectStore(STATE_STORE).put(record.state, record.meta.slotId);
    tx.objectStore(META_STORE).put(record.meta, record.meta.slotId);
    await transactionDone(tx);
  }

  async remove(slotId: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([STATE_STORE, META_STORE], 'readwrite');
    tx.objectStore(STATE_STORE).delete(slotId);
    tx.objectStore(META_STORE).delete(slotId);
    await transactionDone(tx);
  }
}

/** Wählt das beste verfügbare Backend: IndexedDB → LocalStorage → Arbeitsspeicher. */
export function createDefaultStorageProvider(): StorageProvider {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return new IndexedDbStorageProvider(indexedDB);
  } catch {
    // IndexedDB blockiert (z. B. privater Modus) – Fallback.
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tech-empire:probe', '1');
      localStorage.removeItem('tech-empire:probe');
      return new LocalStorageProvider(localStorage);
    }
  } catch {
    // LocalStorage nicht verfügbar.
  }
  return new MemoryStorageProvider();
}
