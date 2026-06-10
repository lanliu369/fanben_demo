import type { ClassificationStore } from '@/types';
import { readAndMigrateLegacyClassificationV1, normalizeClassificationStore } from './migrate-store';
import { defaultClassificationStore } from './seed';

const STORAGE_KEY = 'oo-classification-v3';

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function readStorage(): ClassificationStore {
  if (typeof window === 'undefined') return deepClone(defaultClassificationStore);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fromV1 = readAndMigrateLegacyClassificationV1();
      if (fromV1) {
        const normalized = normalizeClassificationStore(fromV1);
        writeStorage(normalized);
        return normalized;
      }
      return deepClone(defaultClassificationStore);
    }
    return normalizeClassificationStore(JSON.parse(raw) as ClassificationStore);
  } catch {
    return deepClone(defaultClassificationStore);
  }
}

function writeStorage(store: ClassificationStore) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

let cache: ClassificationStore = deepClone(defaultClassificationStore);
let hydrated = false;

export function getClassificationStore(): ClassificationStore {
  if (typeof window !== 'undefined' && !hydrated) {
    cache = readStorage();
    hydrated = true;
  }
  return deepClone(cache);
}

export function getClassificationStoreSsrSnapshot(): ClassificationStore {
  return deepClone(defaultClassificationStore);
}


export function setClassificationStore(store: ClassificationStore) {
  cache = normalizeClassificationStore(deepClone(store));
  hydrated = true;
  writeStorage(cache);
}

export function resetClassificationStoreToSeed() {
  setClassificationStore(deepClone(defaultClassificationStore));
}
