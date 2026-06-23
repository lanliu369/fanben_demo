/** 导入 docx 占位稿（仅含 id 标题）通常小于 8KB */
export const PLACEHOLDER_DOCX_MAX_BYTES = 8192;

/** 国家电投等完整导入稿应明显大于 50KB */
export const IMPORT_DOCX_MIN_BYTES = 50 * 1024;

export function isImportTemplateId(id: string): boolean {
  return id.startsWith('import-');
}
