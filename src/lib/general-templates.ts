import type { GeneralTemplate, GeneralTemplateParsedContent, ClassificationStore } from '@/types';
import { getMockActor } from '@/lib/dataAudit';
import { migrateLegacyCategoryId } from '@/lib/classification/migrate';
import {
  countGeneralTemplateOutlineSections,
  countGeneralTemplateParagraphs,
  buildParsedContentFromHtml,
  parseGeneralTemplateFromDocx,
} from '@/lib/parseGeneralTemplateDocx';
import {
  countGeneralTemplateResources,
  countGeneralTemplateVariables,
} from '@/lib/generalTemplateStats';
import { buildGeneralTemplateEditHtml } from '@/lib/generalTemplateApply';
import { asBlob } from 'html-docx-js-typescript';

const MANIFEST_KEY = 'oo-general-templates';
const PARSED_KEY = 'oo-general-template-parsed';
const DB_NAME = 'fanben-general-templates';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';

function readManifest(): GeneralTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as GeneralTemplate[];
    return entries.map((entry) => ({
      ...entry,
      lotLevelIds: [...new Set((entry.lotLevelIds ?? []).map(normalizeLotLevelId).filter(Boolean))],
    }));
  } catch {
    return [];
  }
}

function writeManifest(entries: GeneralTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

function readParsedMap(): Record<string, GeneralTemplateParsedContent> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PARSED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, GeneralTemplateParsedContent>;
  } catch {
    return {};
  }
}

function writeParsedMap(map: Record<string, GeneralTemplateParsedContent>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PARSED_KEY, JSON.stringify(map));
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

const DOC_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export function isGeneralTemplateDocFile(file: File): boolean {
  const ext = file.name.toLowerCase();
  return (
    ext.endsWith('.docx')
    || ext.endsWith('.doc')
    || DOC_MIME.has(file.type)
  );
}

export function listGeneralTemplates(): GeneralTemplate[] {
  return [...readManifest()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getGeneralTemplateParsedContent(id: string): GeneralTemplateParsedContent | null {
  return readParsedMap()[id] ?? null;
}

function saveParsedContent(id: string, parsed: GeneralTemplateParsedContent): void {
  const map = readParsedMap();
  map[id] = parsed;
  writeParsedMap(map);
}

function deleteParsedContent(id: string): void {
  const map = readParsedMap();
  delete map[id];
  writeParsedMap(map);
}

function normalizeLotLevelId(id: string): string {
  return migrateLegacyCategoryId(id.trim()) || id.trim();
}

export function generalTemplateHasParsedContent(entry: GeneralTemplate): boolean {
  if ((entry.paragraphCount ?? 0) > 0) return true;
  return Boolean(getGeneralTemplateParsedContent(entry.id));
}

/** 列出可用通用模版（不再按品类过滤，保留参数以兼容调用方） */
export function listGeneralTemplatesForLot(
  _lotLevelId?: string,
  _store?: ClassificationStore,
): GeneralTemplate[] {
  return listGeneralTemplates();
}

async function parseAndStoreContent(
  id: string,
  file: Blob,
  previousVersion = 0,
): Promise<GeneralTemplateParsedContent> {
  const parsed = await parseGeneralTemplateFromDocx(file, id, previousVersion);
  saveParsedContent(id, parsed);
  return parsed;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('读取文件失败'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('读取文件失败'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });
}

async function uploadDocxBase64(id: string, base64: string): Promise<void> {
  const uploadResp = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: base64 }),
  });
  if (!uploadResp.ok) {
    throw new Error('上传 DOCX 失败，无法初始化文档');
  }
}

/** 将 IndexedDB / 解析稿同步到服务端 docx，供 WPS 打开 */
export async function ensureGeneralTemplateDocxOnServer(id: string, title: string): Promise<void> {
  const probe = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: 'HEAD' });
  if (probe.ok) {
    const size = parseInt(probe.headers.get('content-length') ?? '0', 10);
    if (size > 8192) return;
  }

  const blob = await getBlob(id);
  if (blob && blob.size > 8192) {
    const content = await blobToBase64(blob);
    await uploadDocxBase64(id, content);
    return;
  }

  const parsed = getGeneralTemplateParsedContent(id);
  if (parsed) {
    const html = buildGeneralTemplateEditHtml(parsed);
    const docBlob = await asBlob(
      `<html><body>${html || `<h1>${title}</h1>`}</body></html>`,
    ) as Blob;
    const content = await blobToBase64(docBlob);
    await uploadDocxBase64(id, content);
    await putBlob(id, docBlob);
    return;
  }

  const fallbackResp = await fetch(`/api/documents/${encodeURIComponent(id)}/heading`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || '通用模版' }),
  });
  if (!fallbackResp.ok) {
    throw new Error('文档初始化失败，请重试');
  }
}

/** 编辑器保存：根据 HTML 重新解析并更新元数据与二进制 */
export async function updateGeneralTemplateFromHtml(id: string, html: string): Promise<GeneralTemplate> {
  const manifest = readManifest();
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('模版不存在');

  const prev = manifest[idx];
  const parsed = buildParsedContentFromHtml(html, id, prev.contentVersion ?? 0);
  saveParsedContent(id, parsed);

  const docBlob = await asBlob(
    `<html><body>${html || `<h1>${prev.name}</h1>`}</body></html>`,
  ) as Blob;
  await putBlob(id, docBlob);

  try {
    const content = await blobToBase64(docBlob);
    await uploadDocxBase64(id, content);
  } catch {
    /* 本地稿已更新；服务端 docx 同步失败不阻断 */
  }

  const now = new Date().toISOString();
  const updated: GeneralTemplate = {
    ...prev,
    updatedAt: now,
    contentVersion: parsed.contentVersion,
    paragraphCount: countGeneralTemplateParagraphs(parsed),
    outlineSectionCount: countGeneralTemplateOutlineSections(parsed),
    variableCount: countGeneralTemplateVariables(parsed),
    resourceCount: countGeneralTemplateResources(parsed),
  };
  const next = [...manifest];
  next[idx] = updated;
  writeManifest(next);
  return updated;
}

export async function saveGeneralTemplate(input: {
  name: string;
  description?: string;
  lotLevelIds?: string[];
  file: File;
  uploadedBy?: string;
}): Promise<GeneralTemplate> {
  const name = input.name.trim();
  if (!name) throw new Error('请填写模版名称');
  if (!isGeneralTemplateDocFile(input.file)) throw new Error('仅支持 Word 模版（.doc / .docx）');

  const lotLevelIds = [...new Set((input.lotLevelIds ?? []).map(normalizeLotLevelId).filter(Boolean))];

  const now = new Date().toISOString();
  const id = `gtpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const parsed = await parseAndStoreContent(id, input.file);

  const entry: GeneralTemplate = {
    id,
    name,
    description: input.description?.trim() || undefined,
    lotLevelIds: [...lotLevelIds],
    originalFileName: input.file.name,
    mimeType: input.file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: input.file.size,
    createdAt: now,
    updatedAt: now,
    uploadedBy: input.uploadedBy?.trim() || getMockActor(),
    contentVersion: parsed.contentVersion,
    templateSyncedVersion: {},
    paragraphCount: countGeneralTemplateParagraphs(parsed),
    outlineSectionCount: countGeneralTemplateOutlineSections(parsed),
    variableCount: countGeneralTemplateVariables(parsed),
    resourceCount: countGeneralTemplateResources(parsed),
  };

  await putBlob(id, input.file);
  const next = [entry, ...readManifest()];
  writeManifest(next);
  return entry;
}

/** 复制通用模版：复用源文件与解析结果，生成新模版记录 */
export async function duplicateGeneralTemplate(
  sourceId: string,
  input: { name: string; description?: string },
): Promise<GeneralTemplate> {
  const manifest = readManifest();
  const source = manifest.find((e) => e.id === sourceId);
  if (!source) throw new Error('源模版不存在');

  const name = input.name.trim();
  if (!name) throw new Error('请填写模版名称');

  const sourceBlob = await getBlob(sourceId);
  if (!sourceBlob) throw new Error('源模版文件不存在，无法复制');

  const now = new Date().toISOString();
  const id = `gtpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const parsed = await parseAndStoreContent(id, sourceBlob);

  await putBlob(id, sourceBlob);

  const entry: GeneralTemplate = {
    id,
    name,
    description: input.description?.trim() || undefined,
    lotLevelIds: [...source.lotLevelIds],
    originalFileName: source.originalFileName,
    mimeType: source.mimeType,
    fileSize: source.fileSize,
    createdAt: now,
    updatedAt: now,
    uploadedBy: getMockActor(),
    contentVersion: parsed.contentVersion,
    templateSyncedVersion: {},
    paragraphCount: countGeneralTemplateParagraphs(parsed),
    outlineSectionCount: countGeneralTemplateOutlineSections(parsed),
    variableCount: countGeneralTemplateVariables(parsed),
    resourceCount: countGeneralTemplateResources(parsed),
  };

  const next = [entry, ...manifest];
  writeManifest(next);

  try {
    const content = await blobToBase64(sourceBlob);
    await uploadDocxBase64(id, content);
  } catch {
    /* 本地复制成功；服务端 docx 同步失败不阻断 */
  }

  return entry;
}

/** 更新模版文件并重新解析；返回更新后的元数据（需调用方触发 syncGeneralTemplateToAllTemplates） */
export async function updateGeneralTemplateFile(
  id: string,
  file: File,
): Promise<GeneralTemplate> {
  if (!isGeneralTemplateDocFile(file)) throw new Error('仅支持 Word 模版（.doc / .docx）');
  const manifest = readManifest();
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('模版不存在');

  const prev = manifest[idx];
  const parsed = await parseAndStoreContent(id, file, prev.contentVersion ?? 0);
  const now = new Date().toISOString();
  const updated: GeneralTemplate = {
    ...prev,
    originalFileName: file.name,
    mimeType: file.type || prev.mimeType,
    fileSize: file.size,
    updatedAt: now,
    contentVersion: parsed.contentVersion,
    paragraphCount: countGeneralTemplateParagraphs(parsed),
    outlineSectionCount: countGeneralTemplateOutlineSections(parsed),
    variableCount: countGeneralTemplateVariables(parsed),
    resourceCount: countGeneralTemplateResources(parsed),
  };

  await putBlob(id, file);
  const next = [...manifest];
  next[idx] = updated;
  writeManifest(next);
  return updated;
}

export function patchGeneralTemplateManifest(id: string, patch: Partial<GeneralTemplate>): GeneralTemplate | null {
  const manifest = readManifest();
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const updated = { ...manifest[idx], ...patch };
  const next = [...manifest];
  next[idx] = updated;
  writeManifest(next);
  return updated;
}

export async function getGeneralTemplateBlob(id: string): Promise<Blob | null> {
  return getBlob(id);
}

export function buildGeneralTemplateDownloadName(entry: GeneralTemplate): string {
  const ext = entry.originalFileName.match(/\.(docx|doc)$/i)?.[0] ?? '.docx';
  const safeName = entry.name.replace(/[/\\?%*:|"<>]/g, '_');
  return `${safeName}${ext}`;
}

export async function deleteGeneralTemplate(id: string): Promise<boolean> {
  const prev = readManifest();
  if (!prev.some((e) => e.id === id)) return false;
  await deleteBlob(id);
  deleteParsedContent(id);
  writeManifest(prev.filter((e) => e.id !== id));
  return true;
}

export function formatGeneralTemplateFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
