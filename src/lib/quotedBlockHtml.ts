function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const QUOTED_BLOCK_CLASS = 'quoted-block';

/** 插入块顶部固定文案（WPS/mammoth 导出后可能仅剩纯文本） */
export const RESOURCE_INSERT_LABEL_MARK = '【引用资源】';

const RESOURCE_INSERT_HINT_MARK = '请勿直接编辑';

/** WPS / 导出 HTML 无 ProseMirror 样式表时的引用块外框（含表格场景） */
export function quotedBlockWrapperStyle(hasTable = false): string {
  const common = [
    'background-color:#fffbeb',
    'border:2px dashed #f59e0b',
    'margin:10px 0',
    'border-radius:8px',
    'box-shadow:0 0 0 3px rgba(245,158,11,0.2)',
  ];
  if (hasTable) {
    return [...common, 'padding:0'].join(';');
  }
  return [...common, 'padding:0 14px 14px 14px'].join(';');
}

/** @deprecated 使用 quotedBlockWrapperStyle */
export function quotedBlockInlineStyle(): string {
  return quotedBlockWrapperStyle(false);
}

/** 引用块顶部提示条（WPS 内联样式，需足够醒目） */
export function resourceInsertLabelHtml(): string {
  return (
    '<div data-resource-insert-label="1" ' +
    'style="display:block;background:linear-gradient(90deg,#f59e0b 0%,#fbbf24 100%);' +
    'color:#78350f;font-weight:600;padding:10px 14px;margin:0;' +
    'border-bottom:2px solid #d97706;' +
    'font-family:inherit;line-height:1.45;">' +
    '<span style="display:block;font-size:14px;font-weight:700;letter-spacing:0.06em;">' +
    '【引用资源】</span>' +
    '<span style="display:block;font-size:11px;font-weight:500;margin-top:5px;opacity:0.96;">' +
    '此处内容由资源库同步，请勿直接编辑；若修改后保存将脱离同步，资源更新时不再自动覆盖。' +
    '</span></div>'
  );
}

/** 将资源正文包为可追踪的引用块（插入范本正文时调用） */
export function wrapQuotedResourceBlock(textFragmentId: string, innerHtml: string): string {
  const fid = escapeHtml(textFragmentId.trim());
  const body = innerHtml.trim();
  const hasTable = /<table[\s>]/i.test(body);
  const style = quotedBlockWrapperStyle(hasTable);
  const innerPad = hasTable ? '<div style="padding:0 2px 10px 2px;">' : '';
  const innerPadClose = hasTable ? '</div>' : '';
  return (
    `<div data-text-fragment-id="${fid}" class="${QUOTED_BLOCK_CLASS}" data-resource-insert="linked" ` +
    `style="${style}">` +
    `${resourceInsertLabelHtml()}${innerPad}${body}${innerPadClose}</div>`
  );
}

function toInsertPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 侧栏插入资源：高亮引用块 + 绑定 textFragmentId */
export function buildResourceInsertHtml(content: string, textFragmentId: string): {
  plainBlock: string;
  htmlBlock: string | undefined;
} {
  const trimmed = (content ?? '').trim();
  const fid = textFragmentId.trim();
  if (!trimmed || !fid) {
    return { plainBlock: '', htmlBlock: undefined };
  }
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  const plainBlock = toInsertPlainText(content);
  if (looksLikeHtml) {
    return { plainBlock, htmlBlock: wrapQuotedResourceBlock(fid, trimmed) };
  }
  if (plainBlock) {
    const inner =
      `<div style="white-space:pre-wrap;color:#334155;line-height:1.7;">` +
      `${escapeHtml(plainBlock).replace(/\n/g, '<br/>')}</div>`;
    return { plainBlock, htmlBlock: wrapQuotedResourceBlock(fid, inner) };
  }
  return { plainBlock: '', htmlBlock: undefined };
}

/** 比对正文时去掉引用块装饰（标签、样式壳） */
export function stripResourceInsertChrome(html: string): string {
  if (!html.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<div[^>]*data-resource-insert-label[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<span[^>]*data-resource-insert-label[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html.trim();
  root.querySelectorAll('[data-resource-insert-label]').forEach((el) => el.remove());
  return root.innerHTML.replace(/\s+/g, ' ').trim();
}

export function normalizeComparableHtml(html: string): string {
  return stripResourceInsertChrome(html)
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 去标签后的纯文本比对（mammoth 导出结构不稳定时使用） */
export function normalizeComparablePlainText(html: string): string {
  return normalizeComparableHtml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从 HTML 中提取仍关联的 textFragmentId 列表 */
export function extractFragmentIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  const re = /data-text-fragment-id=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

function contentDiffersFromCanonical(localHtml: string, canonical: string): boolean {
  const local = normalizeComparablePlainText(localHtml);
  const canon = normalizeComparablePlainText(canonical);
  if (!local && !canon) return false;
  if (!canon) return Boolean(local);
  return local !== canon;
}

function unlinkResourceBlockElement(el: HTMLElement): void {
  el.removeAttribute('data-text-fragment-id');
  el.removeAttribute('data-resource-insert');
  el.classList.remove(QUOTED_BLOCK_CLASS);
  el.removeAttribute('style');
  el.querySelector('[data-resource-insert-label]')?.remove();
}

/** 去掉引用块高亮、提示条与关联属性，保留正文 */
export function stripResourceMarkerAndChromeFromHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (typeof DOMParser === 'undefined') {
    return trimmed
      .replace(/<div[^>]*data-resource-insert-label[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/\s*style="[^"]*(?:fffbeb|f59e0b|dashed)[^"]*"/gi, '')
      .replace(/\s*data-text-fragment-id="[^"]*"/gi, '')
      .replace(/\s*data-resource-insert="[^"]*"/gi, '')
      .replace(/\s*class="quoted-block"/gi, '')
      .trim();
  }

  const doc = new DOMParser().parseFromString(`<div id="root">${trimmed}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return trimmed;

  root.querySelectorAll('[data-text-fragment-id]').forEach((node) => {
    unlinkResourceBlockElement(node as HTMLElement);
  });

  root.querySelectorAll('p, div, span').forEach((node) => {
    const el = node as HTMLElement;
    const text = el.textContent?.trim() ?? '';
    if (
      text.includes(RESOURCE_INSERT_LABEL_MARK) &&
      (text.includes(RESOURCE_INSERT_HINT_MARK) || text.length < 120)
    ) {
      el.remove();
    }
  });

  return root.innerHTML.trim();
}

function reconcileMammothExportedBlock(
  html: string,
  fragmentId: string,
  canonical: string,
  previousHtml: string,
): string {
  if (!html.includes(RESOURCE_INSERT_LABEL_MARK)) return html;
  if (html.includes(`data-text-fragment-id="${fragmentId}"`)) return html;
  if (!previousHtml.includes(`data-text-fragment-id="${fragmentId}"`)) return html;

  const stripped = stripResourceMarkerAndChromeFromHtml(html);
  if (contentDiffersFromCanonical(stripped, canonical)) {
    return stripped;
  }

  const prevPlain = normalizeComparablePlainText(stripResourceInsertChrome(previousHtml));
  const exportPlain = normalizeComparablePlainText(stripped);
  const canonPlain = normalizeComparablePlainText(canonical);
  const resourceOnlySection = exportPlain === canonPlain || prevPlain === canonPlain;

  if (resourceOnlySection) {
    return wrapQuotedResourceBlock(fragmentId, canonical);
  }

  return stripped;
}

/**
 * 保存导出后 reconciling：属性仍在则 detach；mammoth 丢属性时按【引用资源】标记与正文 diff 解除或恢复关联。
 */
export function reconcileExportedResourceBlocksInHtml(
  exportedHtml: string,
  previousHtml: string,
  canonicalByFragmentId: Map<string, string>,
): string {
  let html = detachEditedResourceBlocksInHtml(exportedHtml, canonicalByFragmentId);

  const knownIds = new Set([
    ...extractFragmentIdsFromHtml(previousHtml),
    ...extractFragmentIdsFromHtml(exportedHtml),
  ]);

  for (const fid of knownIds) {
    const canonical = canonicalByFragmentId.get(fid) ?? '';
    if (!canonical.trim()) continue;
    html = reconcileMammothExportedBlock(html, fid, canonical, previousHtml);
  }

  return html;
}

/** 手动改过正文的引用块：去掉关联属性，后续资源同步不再更新该块 */
export function detachEditedResourceBlocksInHtml(
  html: string,
  canonicalByFragmentId: Map<string, string>,
): string {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === 'undefined') return html;
  if (!trimmed.includes('data-text-fragment-id')) return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  root.querySelectorAll('[data-text-fragment-id]').forEach((node) => {
    const el = node as HTMLElement;
    const fid = el.getAttribute('data-text-fragment-id')?.trim();
    if (!fid) return;
    const canonical = canonicalByFragmentId.get(fid);
    if (!canonical) {
      unlinkResourceBlockElement(el);
      return;
    }
    const localInner = stripResourceInsertChrome(el.innerHTML);
    if (contentDiffersFromCanonical(localInner, canonical)) {
      unlinkResourceBlockElement(el);
    }
  });

  return root.innerHTML;
}

/** 将范本正文中仍关联的引用块更新为资源当前稿 */
export function syncResourceBlocksInHtml(
  html: string,
  textFragmentId: string,
  newContent: string,
): string {
  const trimmed = html.trim();
  const fid = textFragmentId.trim();
  if (!trimmed || !fid || !trimmed.includes('data-text-fragment-id')) return html;
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return html;

  const body = newContent.trim();
  root.querySelectorAll(`[data-text-fragment-id="${fid}"]`).forEach((node) => {
    const el = node as HTMLElement;
    const hasTable = /<table[\s>]/i.test(body);
    el.setAttribute('style', quotedBlockWrapperStyle(hasTable));
    const innerPad = hasTable ? '<div style="padding:0 2px 10px 2px;">' : '';
    const innerPadClose = hasTable ? '</div>' : '';
    el.innerHTML = `${resourceInsertLabelHtml()}${innerPad}${body}${innerPadClose}`;
    el.classList.add(QUOTED_BLOCK_CLASS);
    el.setAttribute('data-resource-insert', 'linked');
  });

  return root.innerHTML;
}
