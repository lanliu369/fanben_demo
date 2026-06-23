import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import {
  DOCS_DIR,
  ensureDocumentsDir,
  isImportTemplateId,
  PLACEHOLDER_DOCX_MAX_BYTES,
} from '@/lib/documentsDir';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export type WpsFileRecord = {
  version: number;
  name: string;
  creator_id: string;
  modifier_id: string;
  create_time: number;
  modify_time: number;
};

/**
 * 金山 WebOffice：用户 id 仅允许数字、字母、下划线，不能以下划线开头，长度 ≤48。
 * 见控制台报错「字段 creator_id, 只能由数字、字母、下划线组成, 且不能以下划线开头」。
 */
export function sanitizeWpsUserId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  let s = cleaned.replace(/^_+/, '');
  if (!s) s = 'user0';
  if (s.length > 48) s = s.slice(0, 48);
  return s;
}

export function getWpsDefaultUserId(): string {
  const fromEnv = process.env.WPS_WEBOFFICE_DEFAULT_USER_ID?.trim();
  return sanitizeWpsUserId(fromEnv || 'fanben_editor_user');
}

export function getWpsDefaultUserName(): string {
  return process.env.WPS_WEBOFFICE_DEFAULT_USER_NAME?.trim() || '编制用户';
}

/** 官方要求文件名不含 \ / | ": * ? <> */
export function sanitizeWpsFileName(name: string): string {
  const n = name.replace(/[\\/|":*?<>]/g, '').trim().slice(0, 240);
  return n || 'document.docx';
}

function metaPath(fileId: string) {
  return path.join(DOCS_DIR, `${fileId}.wps.json`);
}

export async function readWpsRecord(fileId: string): Promise<WpsFileRecord | null> {
  try {
    const raw = await fs.readFile(metaPath(fileId), 'utf-8');
    return JSON.parse(raw) as WpsFileRecord;
  } catch {
    return null;
  }
}

export async function writeWpsRecord(fileId: string, rec: WpsFileRecord): Promise<void> {
  ensureDocumentsDir();
  await fs.writeFile(metaPath(fileId), JSON.stringify(rec, null, 0), 'utf-8');
}

async function writeMinimalDocx(filePath: string, title: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${escapeXml(title || '新建文档')}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`,
  );
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buf);
}

async function metaFromExistingDocx(
  fileId: string,
  displayName: string,
  docx: string,
): Promise<WpsFileRecord> {
  const stat = await fs.stat(docx);
  const now = Math.floor(Date.now() / 1000);
  const uid = getWpsDefaultUserId();
  const baseName = sanitizeWpsFileName(`${displayName || fileId}.docx`);
  const rec: WpsFileRecord = {
    version: 1,
    name: baseName.endsWith('.docx') ? baseName : `${baseName}.docx`,
    creator_id: uid,
    modifier_id: uid,
    create_time: now,
    modify_time: Math.floor(stat.mtimeMs / 1000),
  };
  await writeWpsRecord(fileId, rec);
  return rec;
}

/**
 * WPS 回调专用：docx 必须已存在，禁止自动写入占位稿（否则 WPS 会锁定空白文档）。
 */
export async function requireDocxAndMeta(fileId: string, displayName?: string): Promise<WpsFileRecord> {
  const docx = path.join(DOCS_DIR, `${fileId}.docx`);
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(docx);
  } catch {
    throw new Error(`docx missing: ${fileId}`);
  }

  if (isImportTemplateId(fileId) && stat.size < PLACEHOLDER_DOCX_MAX_BYTES) {
    throw new Error(`import docx placeholder: ${fileId}`);
  }

  let rec = await readWpsRecord(fileId);
  if (!rec) {
    rec = await metaFromExistingDocx(fileId, displayName || fileId, docx);
  }
  return rec;
}

/** 新建空白文档时使用；勿在 WPS download / file-info 回调中调用 */
export async function ensureDocxAndMeta(fileId: string, displayName: string): Promise<WpsFileRecord> {
  const docx = path.join(DOCS_DIR, `${fileId}.docx`);
  let rec = await readWpsRecord(fileId);
  try {
    await fs.access(docx);
  } catch {
    ensureDocumentsDir();
    const safeTitle = displayName.replace(/[\\/:*?"<>|]/g, '').slice(0, 120) || fileId;
    await writeMinimalDocx(docx, safeTitle);
  }

  if (!rec) {
    rec = await metaFromExistingDocx(fileId, displayName, docx);
  }
  return rec;
}

export async function bumpVersionAfterSave(fileId: string, name: string): Promise<WpsFileRecord> {
  const prev =
    (await readWpsRecord(fileId)) ??
    (await requireDocxAndMeta(fileId, name.replace(/\.docx$/i, '')));
  let safeName = sanitizeWpsFileName(name);
  if (!safeName.toLowerCase().endsWith('.docx')) {
    safeName = `${safeName}.docx`;
  }
  const now = Math.floor(Date.now() / 1000);
  const uid = getWpsDefaultUserId();
  const next: WpsFileRecord = {
    ...prev,
    version: prev.version + 1,
    name: safeName,
    modifier_id: uid,
    modify_time: now,
  };
  await writeWpsRecord(fileId, next);
  return next;
}

export async function buildWpsFileInfo(
  fileId: string,
  rec: WpsFileRecord,
): Promise<{
  id: string;
  name: string;
  version: number;
  size: number;
  create_time: number;
  modify_time: number;
  creator_id: string;
  modifier_id: string;
}> {
  const docx = path.join(DOCS_DIR, `${fileId}.docx`);
  const stat = await fs.stat(docx);
  return {
    id: fileId,
    name: rec.name,
    version: rec.version,
    size: stat.size,
    create_time: rec.create_time,
    modify_time: rec.modify_time,
    creator_id: sanitizeWpsUserId(rec.creator_id),
    modifier_id: sanitizeWpsUserId(rec.modifier_id),
  };
}
