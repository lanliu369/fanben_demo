import fs from 'fs';
import path from 'path';

export {
  IMPORT_DOCX_MIN_BYTES,
  isImportTemplateId,
  PLACEHOLDER_DOCX_MAX_BYTES,
} from '@/lib/documentStorageConstants';

function resolveDocumentsDir(): string {
  const fromEnv = process.env.DOCUMENTS_DATA_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), 'public', 'documents');
}

export const DOCS_DIR = resolveDocumentsDir();

export function ensureDocumentsDir(): void {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

export function docxPathForId(id: string): string {
  return path.join(DOCS_DIR, `${id}.docx`);
}
