import {
  ensureSolidTableBorderInline,
  stripTablePresentationInlineStyles,
} from '@/lib/resourcePreviewHtml';

/**
 * 侧栏资源插入金山 WebOffice：与资源管理正文预览相同流水线——
 * 先剥离 Word/WPS 在 table/td 上的 border:none、虚线、mso-border 等，再注入黑色实线内联，
 * 避免 PasteHtml 后仍为虚线或无边框。
 */
export function normalizePasteHtmlForWps(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  const stripped = stripTablePresentationInlineStyles(html.trim());
  return ensureSolidTableBorderInline(stripped);
}
