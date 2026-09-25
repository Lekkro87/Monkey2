import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { simulateDays } from '@/simulation/GameSimulation';
import { SaveError, SaveService } from '@/services/saveService';
import { IndexedDbStorageProvider, LocalStorageProvider, MemoryStorageProvider } from '@/services/storage/providers';
import type { StorageProvider } from '@/services/storage/types';
import { newTestGame } from './helpers';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const providers: [string, () => StorageProvider][] = [
  ['Memory', () => new MemoryStorageProvider()],
  ['LocalStorage', () => new LocalStorageProvider(new FakeStorage())],
  ['IndexedDB', () => new IndexedDbStorageProvider(new IDBFactory())],
];

describe.each(providers)('SaveService mit %s', (_name, create) => {
  it('speichert, listet, lädt und löscht Spielstände', async () => {
    const service = new SaveService(create());
    const state = simulateDays(newTestGame('normal', 5), 40);
    const meta = await service.save('slot-1', state);
    expect(meta.companyName).toBe('NovaTech');
    await service.save('autosave', simulateDays(state, 5));
    const list = await service.list();
    expect(list.map((m) => m.slotId).sort()).toEqual(['autosave', 'slot-1']);
    const loaded = await service.load('slot-1');
    expect(loaded.time.day).toBe(40);
    expect(JSON.stringify(simulateDays(loaded, 30))).toBe(JSON.stringify(simulateDays(state, 30)));
    await service.remove('slot-1');
    expect((await service.list()).map((m) => m.slotId)).toEqual(['autosave']);
    await expect(service.load('slot-1')).rejects.toBeInstanceOf(SaveError);
  });
});

describe('Export/Import', () => {
  it('exportiert und importiert JSON', () => {
    const service = new SaveService(new MemoryStorageProvider());
    const state = simulateDays(newTestGame('hard', 8), 20);
    const imported = service.importJson(service.exportJson(state));
    expect(imported.company.name).toBe(state.company.name);
    expect(imported.time.day).toBe(20);
  });

  it('weist ungültige Dateien und neuere Versionen zurück', () => {
    const service = new SaveService(new MemoryStorageProvider());
    expect(() => service.importJson('kein json')).toThrow(SaveError);
    expect(() => service.importJson(JSON.stringify({ foo: 1 }))).toThrow(SaveError);
    const future = { ...newTestGame(), schemaVersion: 999 };
    expect(() => service.importJson(JSON.stringify(future))).toThrow(/neueren/);
  });
});
