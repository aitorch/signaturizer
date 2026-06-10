import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSignatureStore,
  createMemoryAdapter,
  createFsAdapter,
} from '../signature-store.js';

describe('createMemoryAdapter', () => {
  it('starts empty by default', () => {
    const adapter = createMemoryAdapter();
    expect(adapter.read()).toEqual([]);
  });

  it('accepts initial data', () => {
    const data = [{ id: '1', name: 'test' }];
    const adapter = createMemoryAdapter(data);
    expect(adapter.read()).toEqual(data);
  });

  it('does not mutate the original initial data array', () => {
    const data = [{ id: '1', name: 'test' }];
    const adapter = createMemoryAdapter(data);
    adapter.write([{ id: '2', name: 'other' }]);
    expect(data).toEqual([{ id: '1', name: 'test' }]);
  });

  it('write then read round-trips correctly', () => {
    const adapter = createMemoryAdapter();
    const data = [{ id: '1' }, { id: '2' }];
    adapter.write(data);
    expect(adapter.read()).toEqual(data);
  });

  it('read returns a copy (mutations do not affect store)', () => {
    const adapter = createMemoryAdapter();
    adapter.write([{ id: '1' }]);
    const copy = adapter.read();
    copy.push({ id: '2' });
    expect(adapter.read()).toHaveLength(1);
  });

  it('handles non-array initialData gracefully', () => {
    const adapter = createMemoryAdapter('bad');
    expect(adapter.read()).toEqual([]);
  });
});

describe('createSignatureStore', () => {
  let adapter;
  let store;

  beforeEach(() => {
    adapter = createMemoryAdapter();
    store = createSignatureStore(adapter);
  });

  describe('load()', () => {
    it('returns empty array when store is empty', () => {
      expect(store.load()).toEqual([]);
    });

    it('returns previously saved data', () => {
      const data = [{ id: '1', name: 'sig' }];
      store.save(data);
      expect(store.load()).toEqual(data);
    });

    it('returns empty array if adapter returns non-array', () => {
      const badAdapter = {
        read: () => 'not an array',
        write: () => {},
      };
      const badStore = createSignatureStore(badAdapter);
      expect(badStore.load()).toEqual([]);
    });
  });

  describe('save()', () => {
    it('saves and returns the array', () => {
      const data = [{ id: '1' }];
      const result = store.save(data);
      expect(result).toEqual(data);
      expect(store.load()).toEqual(data);
    });

    it('throws if argument is not an array', () => {
      expect(() => store.save('bad')).toThrow(TypeError);
      expect(() => store.save(null)).toThrow(TypeError);
    });
  });

  describe('add()', () => {
    it('creates entry with UUID, timestamps, and correct data', () => {
      const before = Date.now();
      const sig = store.add('My Sig', 'data:image/png;base64,abc');
      const after = Date.now();

      expect(sig.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(sig.name).toBe('My Sig');
      expect(sig.imageData).toBe('data:image/png;base64,abc');
      expect(sig.createdAt).toBe(sig.updatedAt);
      const created = new Date(sig.createdAt).getTime();
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
    });

    it('appends to existing signatures', () => {
      store.add('First', 'img1');
      store.add('Second', 'img2');
      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe('First');
      expect(all[1].name).toBe('Second');
    });
  });

  describe('getAll()', () => {
    it('returns empty array when no signatures exist', () => {
      expect(store.getAll()).toEqual([]);
    });

    it('returns all signatures', () => {
      store.add('A', 'a');
      store.add('B', 'b');
      store.add('C', 'c');
      expect(store.getAll()).toHaveLength(3);
    });

    it('returns defensive copies (mutations do not affect store)', () => {
      store.add('Original', 'img');
      const all = store.getAll();
      all[0].name = 'MUTATED';
      const refetched = store.getAll();
      expect(refetched[0].name).toBe('Original');
    });
  });

  describe('getById()', () => {
    it('returns the correct signature', () => {
      const sig = store.add('Find Me', 'img');
      const result = store.getById(sig.id);
      expect(result).toEqual(sig);
    });

    it('returns null for missing id', () => {
      expect(store.getById('does-not-exist')).toBeNull();
    });

    it('returns a defensive copy (mutations do not affect store)', () => {
      const sig = store.add('Original', 'img');
      const copy = store.getById(sig.id);
      copy.name = 'MUTATED';
      const refetched = store.getById(sig.id);
      expect(refetched.name).toBe('Original');
    });
  });

  describe('delete()', () => {
    it('removes the correct entry', () => {
      const sig1 = store.add('Keep', 'img1');
      const sig2 = store.add('Remove', 'img2');
      const result = store.delete(sig2.id);
      expect(result).toBe(true);
      expect(store.getAll()).toHaveLength(1);
      expect(store.getById(sig1.id)).not.toBeNull();
      expect(store.getById(sig2.id)).toBeNull();
    });

    it('returns false when id not found', () => {
      store.add('A', 'a');
      expect(store.delete('nonexistent')).toBe(false);
      expect(store.getAll()).toHaveLength(1);
    });

    it('does not affect other signatures', () => {
      const sig1 = store.add('A', 'a');
      const sig2 = store.add('B', 'b');
      const sig3 = store.add('C', 'c');
      store.delete(sig2.id);
      const remaining = store.getAll();
      expect(remaining.map((s) => s.id)).toEqual([sig1.id, sig3.id]);
    });
  });

  describe('update()', () => {
    it('updates name', () => {
      const sig = store.add('Old', 'img');
      const updated = store.update(sig.id, { name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.imageData).toBe('img');
    });

    it('updates imageData', () => {
      const sig = store.add('Sig', 'old-img');
      const updated = store.update(sig.id, { imageData: 'new-img' });
      expect(updated.imageData).toBe('new-img');
      expect(updated.name).toBe('Sig');
    });

    it('bumps updatedAt', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const sig = store.add('Sig', 'img');
      expect(sig.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
      const updated = store.update(sig.id, { name: 'Updated' });
      vi.useRealTimers();

      expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(updated.updatedAt).not.toBe(sig.updatedAt);
    });

    it('preserves createdAt', () => {
      const sig = store.add('Sig', 'img');
      const updated = store.update(sig.id, { name: 'New' });
      expect(updated.createdAt).toBe(sig.createdAt);
    });

    it('returns null for missing id', () => {
      expect(store.update('missing', { name: 'X' })).toBeNull();
    });

    it('returns a copy (not a reference to internal array item)', () => {
      const sig = store.add('Sig', 'img');
      const updated = store.update(sig.id, { name: 'New' });
      expect(updated).toEqual(store.getById(sig.id));
      expect(updated).not.toBe(store.getById(sig.id));
      updated.name = 'MUTATED';
      const refetched = store.getById(sig.id);
      expect(refetched.name).toBe('New');
    });
  });

  describe('persistence across store instances', () => {
    it('data persists when creating a new store with the same adapter', () => {
      const sig1 = store.add('First', 'img1');
      const sig2 = store.add('Second', 'img2');

      const store2 = createSignatureStore(adapter);
      expect(store2.getAll()).toHaveLength(2);
      expect(store2.getById(sig1.id)).not.toBeNull();
      expect(store2.getById(sig2.id)).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles empty name', () => {
      const sig = store.add('', 'img');
      expect(sig.name).toBe('');
      expect(store.getById(sig.id)).not.toBeNull();
    });

    it('handles very large imageData string', () => {
      const bigData = 'data:image/png;base64,' + 'A'.repeat(1_000_000);
      const sig = store.add('Big', bigData);
      expect(store.getById(sig.id).imageData).toBe(bigData);
    });

    it('handles special characters in name', () => {
      const specialName = 'Sig with "quotes" & <tags> and émojis 🎉';
      const sig = store.add(specialName, 'img');
      expect(store.getById(sig.id).name).toBe(specialName);
    });

    it('coerces non-string name and imageData to strings', () => {
      const sig = store.add(123, 456);
      expect(sig.name).toBe('123');
      expect(sig.imageData).toBe('456');
    });
  });

  describe('corrupt data recovery', () => {
    it('recovers gracefully from corrupt adapter data', () => {
      const corruptAdapter = createMemoryAdapter([
        { id: '1', name: 'valid' },
        { notASignature: true },
      ]);
      const corruptStore = createSignatureStore(corruptAdapter);
      // load() returns whatever the adapter has — it doesn't validate entries
      // But add/delete/update/getById should still work on whatever's there
      const sig = corruptStore.add('New', 'img');
      const all = corruptStore.getAll();
      expect(all).toHaveLength(3);
      expect(all[2]).toEqual(sig);
    });
  });
});

describe('createFsAdapter', () => {
  it('returns empty array when file does not exist', () => {
    const files = {};
    const mockFs = {
      existsSync: () => false,
      writeFileSync: (p, data) => {
        files[p] = data;
      },
      readFileSync: () => {
        throw new Error('ENOENT');
      },
    };
    const mockPath = { join: (dir, name) => `${dir}/${name}` };
    const adapter = createFsAdapter('/tmp/test-sigs', mockFs, mockPath);
    expect(adapter.read()).toEqual([]);
  });

  it('write then read returns same data', () => {
    const files = {};
    const mockFs = {
      existsSync: () => true,
      writeFileSync: (p, data) => {
        files[p] = data;
      },
      readFileSync: (p) => files[p] ?? '[]',
    };
    const mockPath = { join: (dir, name) => `${dir}/${name}` };
    const filePath = '/tmp/test-sigs/signatures.json';
    const adapter = createFsAdapter('/tmp/test-sigs', mockFs, mockPath);
    const data = [{ id: '1', name: 'test' }];
    adapter.write(data);
    const result = adapter.read();
    expect(result).toEqual(data);
  });

  it('returns empty array for corrupt JSON', () => {
    const files = { '/tmp/test-sigs/signatures.json': 'not valid json{' };
    const mockFs = {
      existsSync: () => true,
      writeFileSync: (p, data) => {
        files[p] = data;
      },
      readFileSync: (p) => files[p],
    };
    const mockPath = { join: (dir, name) => `${dir}/${name}` };
    const adapter = createFsAdapter('/tmp/test-sigs', mockFs, mockPath);
    expect(adapter.read()).toEqual([]);
  });
});
