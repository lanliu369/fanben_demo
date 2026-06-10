/** 表格等紧凑场景下的副文案预览长度 */
export const TABLE_DESC_PREVIEW_LEN = 22;

export function previewTableText(text: string, maxLen = TABLE_DESC_PREVIEW_LEN): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
