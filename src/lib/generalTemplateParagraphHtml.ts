import {
  normalizeComparablePlainText,
  stripResourceInsertChrome,
} from '@/lib/quotedBlockHtml';

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const GENERAL_TEMPLATE_BLOCK_CLASS = 'general-template-block';

export const GENERAL_TEMPLATE_INSERT_LABEL_MARK = '【引用模版】';

const GENERAL_TEMPLATE_INSERT_HINT_MARK = '请勿直接编辑';

export function generalTemplateBlockWrapperStyle(hasTable = false): string {
  const common = [
    'background-color:#eff6ff',
    'border:2px dashed #3b82f6',
    'margin:10px 0',
    'border-radius:8px',
    'box-shadow:0 0 0 3px rgba(59,130,246,0.15)',
  ];
  if (hasTable) {
    return [...common, 'padding:0'].join(';');
  }
  return [...common, 'padding:0 14px 14px 14px'].join(';');
}

export function generalTemplateInsertLabelHtml(): string {
  return (
    '<div data-general-template-insert-label="1" ' +
    'style="display:block;background:linear-gradient(90deg,#3b82f6 0%,#60a5fa 100%);' +
    'color:#1e3a8a;font-weight:600;padding:10px 14px;margin:0;' +
    'border-bottom:2px solid #2563eb;' +
    'font-family:inherit;line-height:1.45;">' +
    '<span style="display:block;font-size:14px;font-weight:700;letter-spacing:0.06em;">' +
    '【引用模版】</span>' +
    '<span style="display:block;font-size:11px;font-weight:500;margin-top:5px;opacity:0.96;">' +
    '此处内容由通用模版同步，请勿直接编辑；若修改后保存将脱离同步，模版更新时不再自动覆盖。' +
    '</span></div>'
  );
}

/** 将模版段落包为可追踪的引用块 */
export function wrapGeneralTemplateParagraph(
  generalTemplateId: string,
  paragraphId: string,
  innerHtml: string,
): string {
  const gtId = escapeHtml(generalTemplateId.trim());
  const pid = escapeHtml(paragraphId.trim());
  const body = innerHtml.trim();
  const hasTable = /<table[\s>]/i.test(body);
  const style = generalTemplateBlockWrapperStyle(hasTable);
  const innerPad = hasTable ? '<div style="padding:0 2px 10px 2px;">' : '';
  const innerPadClose = hasTable ? '</div>' : '';
  return (
    `<div data-general-template-id="${gtId}" data-general-template-paragraph-id="${pid}" ` +
    `class="${GENERAL_TEMPLATE_BLOCK_CLASS}" data-general-template-insert="linked" ` +
    `style="${style}">` +
    `${generalTemplateInsertLabelHtml()}${innerPad}${body}${innerPadClose}</div>`
  );
}

export function stripGeneralTemplateInsertChrome(html: string): string {
  if (!html.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<div[^>]*data-general-template-insert-label[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html.trim();
  root.querySelectorAll('[data-general-template-insert-label]').forEach((el) => el.remove());
  return root.innerHTML.replace(/\s+/g, ' ').trim();
}

function contentDiffersFromCanonical(localHtml: string, canonical: string): boolean {
  const local = normalizeComparablePlainText(stripGeneralTemplateInsertChrome(localHtml));
  const canon = normalizeComparablePlainText(canonical);
  if (!local && !canon) return false;
  if (!canon) return Boolean(local);
  return local !== canon;
}

function unlinkGeneralTemplateBlockElement(el: HTMLElement): void {
  el.removeAttribute('data-general-template-id');
  el.removeAttribute('data-general-template-paragraph-id');
  el.removeAttribute('data-general-template-insert');
  el.classList.remove(GENERAL_TEMPLATE_BLOCK_CLASS);
  el.removeAttribute('style');
  el.querySelector('[data-general-template-insert-label]')?.remove();
}

export function stripGeneralTemplateMarkerAndChromeFromHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (typeof DOMParser === 'undefined') {
    return trimmed
      .replace(/<div[^>]*data-general-template-insert-label[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/\s*data-general-template-id="[^"]*"/gi, '')
      .replace(/\s*data-general-template-paragraph-id="[^"]*"/gi, '')
      .replace(/\s*data-general-template-insert="[^"]*"/gi, '')
      .replace(/\s*class="general-template-block"/gi, '')
      .trim();
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${trimmed}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return trimmed;
  root.querySelectorAll('[data-general-template-paragraph-id]').forEach((node) => {
    unlinkGeneralTemplateBlockElement(node as HTMLElement);
  });
  return root.innerHTML.trim();
}

/** 从 HTML 中提取仍关联的模版段落 id */
export function extractGeneralTemplateParagraphIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  const re = /data-general-template-paragraph-id=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** 手动改过正文的模版引用块：去掉关联属性 */
export function detachEditedGeneralTemplateBlocksInHtml(
  html: string,
  canonicalByParagraphId: Map<string, string>,
): string {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === 'undefined') return html;
  if (!trimmed.includes('data-general-template-paragraph-id')) return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  root.querySelectorAll('[data-general-template-paragraph-id]').forEach((node) => {
    const el = node as HTMLElement;
    const pid = el.getAttribute('data-general-template-paragraph-id')?.trim();
    if (!pid) return;
    const canonical = canonicalByParagraphId.get(pid);
    if (!canonical) {
      unlinkGeneralTemplateBlockElement(el);
      return;
    }
    const localInner = stripGeneralTemplateInsertChrome(el.innerHTML);
    if (contentDiffersFromCanonical(localInner, canonical)) {
      unlinkGeneralTemplateBlockElement(el);
    }
  });

  return root.innerHTML;
}

function reconcileMammothExportedGeneralBlock(
  html: string,
  generalTemplateId: string,
  paragraphId: string,
  canonical: string,
  previousHtml: string,
): string {
  if (!html.includes(GENERAL_TEMPLATE_INSERT_LABEL_MARK)) return html;
  if (html.includes(`data-general-template-paragraph-id="${paragraphId}"`)) return html;
  if (!previousHtml.includes(`data-general-template-paragraph-id="${paragraphId}"`)) return html;

  const stripped = stripGeneralTemplateMarkerAndChromeFromHtml(html);
  if (contentDiffersFromCanonical(stripped, canonical)) {
    return stripped;
  }

  const prevPlain = normalizeComparablePlainText(stripGeneralTemplateInsertChrome(previousHtml));
  const exportPlain = normalizeComparablePlainText(stripped);
  const canonPlain = normalizeComparablePlainText(canonical);
  if (exportPlain === canonPlain || prevPlain === canonPlain) {
    return wrapGeneralTemplateParagraph(generalTemplateId, paragraphId, canonical);
  }
  return stripped;
}

export function reconcileExportedGeneralTemplateBlocksInHtml(
  exportedHtml: string,
  previousHtml: string,
  generalTemplateId: string,
  canonicalByParagraphId: Map<string, string>,
): string {
  let html = detachEditedGeneralTemplateBlocksInHtml(exportedHtml, canonicalByParagraphId);
  const knownIds = new Set([
    ...extractGeneralTemplateParagraphIdsFromHtml(previousHtml),
    ...extractGeneralTemplateParagraphIdsFromHtml(exportedHtml),
  ]);
  for (const pid of knownIds) {
    const canonical = canonicalByParagraphId.get(pid) ?? '';
    if (!canonical.trim()) continue;
    html = reconcileMammothExportedGeneralBlock(html, generalTemplateId, pid, canonical, previousHtml);
  }
  return html;
}

/** 将范本正文中仍关联的模版段落更新为模版当前稿 */
export function syncGeneralTemplateBlocksInHtml(
  html: string,
  generalTemplateId: string,
  paragraphId: string,
  newContent: string,
): string {
  const trimmed = html.trim();
  const pid = paragraphId.trim();
  const gtId = generalTemplateId.trim();
  if (!trimmed || !pid || !gtId || !trimmed.includes('data-general-template-paragraph-id')) return html;
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  const body = newContent.trim();
  root.querySelectorAll(`[data-general-template-paragraph-id="${pid}"]`).forEach((node) => {
    const el = node as HTMLElement;
    const hasTable = /<table[\s>]/i.test(body);
    el.setAttribute('style', generalTemplateBlockWrapperStyle(hasTable));
    const innerPad = hasTable ? '<div style="padding:0 2px 10px 2px;">' : '';
    const innerPadClose = hasTable ? '</div>' : '';
    el.innerHTML = `${generalTemplateInsertLabelHtml()}${innerPad}${body}${innerPadClose}`;
    el.classList.add(GENERAL_TEMPLATE_BLOCK_CLASS);
    el.setAttribute('data-general-template-id', gtId);
    el.setAttribute('data-general-template-insert', 'linked');
  });

  return root.innerHTML;
}

/** 比对时忽略资源引用块装饰，避免资源插入误判为模版段落变更 */
export function stripNonGeneralTemplateChromeForCompare(html: string): string {
  return stripResourceInsertChrome(stripGeneralTemplateInsertChrome(html));
}
