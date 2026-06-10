import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Create a filesystem storage adapter for Electron.
 * Reads/writes signatures.json in the given directory.
 *
 * @param {string} dirPath - Directory where signatures.json lives
 * @returns {{ read: () => Array, write: (data: Array) => void }}
 */
export function createFsAdapter(dirPath, fsImpl = fs, pathImpl = path) {
  const filePath = pathImpl.join(dirPath, 'signatures.json');

  return {
    read() {
      try {
        if (!fsImpl.existsSync(filePath)) {
          fsImpl.writeFileSync(filePath, '[]', 'utf-8');
          return [];
        }
        const raw = fsImpl.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    write(data) {
      fsImpl.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
  };
}

/**
 * Create an in-memory storage adapter for testing.
 *
 * @param {Array} [initialData=[]] - Optional initial data
 * @returns {{ read: () => Array, write: (data: Array) => void }}
 */
export function createMemoryAdapter(initialData = []) {
  let store = Array.isArray(initialData) ? [...initialData] : [];
  return {
    read() {
      return [...store];
    },
    write(data) {
      store = [...data];
    },
  };
}

/**
 * Create a signature store backed by the given adapter.
 *
 * @param {{ read: () => Array, write: (data: Array) => void }} adapter
 * @returns {{ load, save, add, delete, update, getById, getAll }}
 */
export function createSignatureStore(adapter) {
  function load() {
    try {
      const data = adapter.read();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(signatures) {
    if (!Array.isArray(signatures)) {
      throw new TypeError('signatures must be an array');
    }
    adapter.write(signatures);
    return signatures;
  }

  function add(name, imageData) {
    const now = new Date().toISOString();
    const entry = {
      id: uuidv4(),
      name: String(name),
      imageData: String(imageData),
      createdAt: now,
      updatedAt: now,
    };
    const existing = load();
    existing.push(entry);
    save(existing);
    return entry;
  }

  function deleteSig(id) {
    const existing = load();
    const filtered = existing.filter((s) => s.id !== id);
    if (filtered.length === existing.length) {
      return false;
    }
    save(filtered);
    return true;
  }

  function update(id, updates) {
    const existing = load();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx === -1) {
      return null;
    }
    const updated = { ...existing[idx] };
    if (updates.name !== undefined) {
      updated.name = String(updates.name);
    }
    if (updates.imageData !== undefined) {
      updated.imageData = String(updates.imageData);
    }
    updated.updatedAt = new Date().toISOString();
    existing[idx] = updated;
    save(existing);
    return { ...updated };
  }

  function getById(id) {
    const existing = load();
    const found = existing.find((s) => s.id === id);
    return found ? { ...found } : null;
  }

  function getAll() {
    const signatures = load();
    return signatures.map((s) => ({ ...s }));
  }

  return { load, save, add, delete: deleteSig, update, getById, getAll };
}
