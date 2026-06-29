import type { CategoryFileUpload } from '@/types';
import { getMockActor } from '@/lib/dataAudit';

const MANIFEST_KEY = 'oo-category-file-uploads';
const DB_NAME = 'fanben-category-file-uploads';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';

function readManifest(): CategoryFileUpload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CategoryFileUpload[];
  } catch {
    return [];
  }
}

function writeManifest(entries: CategoryFileUpload[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
}

async function deleteBlob(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
  });
}

const EXCEL_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

export function isCategoryExcelFile(file: File): boolean {
  const ext = file.name.toLowerCase();
  return (
    ext.endsWith('.xlsx')
    || ext.endsWith('.xls')
    || EXCEL_MIME.has(file.type)
  );
}

export function listCategoryFileUploads(): CategoryFileUpload[] {
  return [...readManifest()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function parseCategoryFileDisplayName(file: File): string {
  const base = file.name.replace(/\.[^.]+$/i, '').trim();
  return base || file.name.trim() || '未命名文件';
}

export async function saveCategoryFileUpload(input: {
  file: File;
  uploadedBy?: string;
}): Promise<CategoryFileUpload> {
  if (!isCategoryExcelFile(input.file)) throw new Error('仅支持 Excel 原始文件（.xlsx / .xls）');

  const name = parseCategoryFileDisplayName(input.file);
  const id = `cat-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: CategoryFileUpload = {
    id,
    name,
    originalFileName: input.file.name,
    mimeType: input.file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSize: input.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy?.trim() || getMockActor(),
  };

  await putBlob(id, input.file);
  const next = [entry, ...readManifest()];
  writeManifest(next);
  return entry;
}

export async function getCategoryFileUploadBlob(id: string): Promise<Blob | null> {
  return getBlob(id);
}

export function buildCategoryFileDownloadName(entry: CategoryFileUpload): string {
  const ext = entry.originalFileName.match(/\.(xlsx|xls)$/i)?.[0] ?? '.xlsx';
  const safeName = entry.name.replace(/[/\\?%*:|"<>]/g, '_');
  return `${safeName}${ext}`;
}

export async function deleteCategoryFileUpload(id: string): Promise<boolean> {
  const prev = readManifest();
  if (!prev.some((e) => e.id === id)) return false;
  await deleteBlob(id);
  writeManifest(prev.filter((e) => e.id !== id));
  return true;
}

export function formatCategoryFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
