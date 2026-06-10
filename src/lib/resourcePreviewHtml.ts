import { outlineSpacingHtml } from '@/lib/outlineSpacingHtml';

function mergeStyleAttr(existing: string | null, append: string): string {
  const a = (existing ?? '').trim().replace(/;+/g, ';').replace(/^;|;$/g, '');
  const b = append.trim().replace(/^;|;$/g, '');
  if (!a) return b;
  if (!b) return a;
  return `${a};${b}`;
}

/**
 * Word/WPS 导出的 HTML 常在 table/td 上带 border:none、border="0" 等内联样式，
 * 浏览器优先级高于外链样式表，导致预览区表格边框无法显示。预览专用：剥离表格相关 presentation 内联样式。
 */
export function stripTablePresentationInlineStyles(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('table, thead, tbody, tfoot, tr, td, th').forEach((node) => {
      const el = node as HTMLElement;
      el.removeAttribute('border');
      const cls = el.getAttribute('class');
      if (cls?.includes('screen-only-border')) {
        const next = cls.replace(/\bscreen-only-border\b/g, '').replace(/\s+/g, ' ').trim();
        if (next) el.setAttribute('class', next);
        else el.removeAttribute('class');
      }
      const style = el.getAttribute('style');
      if (!style) return;
      const kept = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((decl) => {
          const prop = decl.split(':')[0]?.trim().toLowerCase() ?? '';
          /* 保留表格布局相关，勿误删（startsWith('border') 会干掉 border-collapse / border-spacing） */
          if (prop === 'border-collapse' || prop === 'border-spacing') return true;
          if (prop.startsWith('outline')) return false;
          if (prop.startsWith('mso-border')) return false;
          if (prop.startsWith('border')) return false;
          return true;
        })
        .join('; ');
      if (kept) el.setAttribute('style', kept);
      else el.removeAttribute('style');
    });
    return tpl.innerHTML;
  } catch {
    return html;
  }
}

/**
 * 对 HTML 中的 `<table>` 注入黑色实线边框内联（预览区 / WPS PasteHtml 共用）。
 */
export function ensureSolidTableBorderInline(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  if (!/<table[\s>]/i.test(html)) return html;
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    tpl.content.querySelectorAll('table').forEach((tbl) => {
      const el = tbl as HTMLElement;
      /* 勿强行 width:100%，否则 Word/Tiptap 的列宽比例在 WPS PasteHtml 中被拉平 */
      el.setAttribute(
        'style',
        mergeStyleAttr(el.getAttribute('style'), 'border-collapse:collapse;border:2px solid #000'),
      );
      tbl.querySelectorAll('td, th').forEach((cell) => {
        const c = cell as HTMLElement;
        let merged = mergeStyleAttr(c.getAttribute('style'), 'border:1px solid #000');
        /* 原稿无内边距时补最小 padding，避免行高/字行距看起来「挤在一起」 */
        if (!/\bpadding\b/i.test(merged)) {
          merged = mergeStyleAttr(merged, 'padding:4px 6px');
        }
        c.setAttribute('style', merged);
      });
    });
    return tpl.innerHTML;
  } catch {
    return html;
  }
}

export function buildResourcePreviewHtml(raw: string, applyInlineStrip: boolean): string {
  const spaced = outlineSpacingHtml(raw);
  if (!applyInlineStrip) return spaced;
  const stripped = stripTablePresentationInlineStyles(spaced);
  return ensureSolidTableBorderInline(stripped);
}
