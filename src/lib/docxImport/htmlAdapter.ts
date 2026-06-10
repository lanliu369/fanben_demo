/**
 * HTML Adapter
 * 在 DOCX 解析生成的 HTML 注入 Tiptap 编辑器之前，进行标准化转换
 * 核心目标：让 Tiptap 能最大程度保留原始 DOCX 样式
 */

export interface AdapterOptions {
  /** 是否将 DOCX 伪列表段落转为原生列表 */
  convertLists?: boolean;
  /** 是否标记导入表格，避免 CSS 默认样式覆盖 */
  markImportedTables?: boolean;
  /** 是否标准化图片样式 */
  normalizeImages?: boolean;
}

const defaultOptions: AdapterOptions = {
  convertLists: true,
  markImportedTables: true,
  normalizeImages: true,
};

/**
 * 主入口：将原始 DOCX HTML 转换为 Tiptap 友好的 HTML
 */
export function adaptHtmlForEditor(rawHtml: string, options: AdapterOptions = {}): string {
  const opts = { ...defaultOptions, ...options };

  // 处理 XML 命名空间前缀（OpenXML 有时会带前缀如 <w:p>，但 parseDocxEnhanced 输出的是标准 HTML）
  const html = rawHtml;

  // 用 DOMParser 处理
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="adapter-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('adapter-root');
  if (!root) return html;

  if (opts.convertLists) {
    convertDocxListsToNativeLists(root);
  }

  if (opts.markImportedTables) {
    markImportedTables(root);
  }

  if (opts.normalizeImages) {
    normalizeImageStyles(root);
  }

  // 清理不必要的空标签，但保留空段落（Word 中用于占位）
  cleanEmptyTags(root);

  return root.innerHTML;
}

/**
 * 将 DOCX 伪列表段落转换为原生 <ul>/<ol>/<li>
 *
 * DOCX 解析器会生成类似：
 * <p data-list-type="ordered" data-list-level="0"><span class="list-marker">1.</span>内容</p>
 *
 * 转换为：
 * <ol><li>内容</li></ol>
 *
 * 支持多级嵌套列表
 */
function convertDocxListsToNativeLists(root: HTMLElement) {
  const doc = root.ownerDocument;
  const listParagraphs = Array.from(root.querySelectorAll('p[data-list-type]')) as HTMLElement[];
  if (listParagraphs.length === 0) return;

  // 按文档顺序处理
  const groups: Array<{
    type: 'ordered' | 'unordered';
    level: number;
    items: HTMLElement[];
  }> = [];

  let currentGroup: typeof groups[0] | null = null;

  for (const p of listParagraphs) {
    const type = (p.getAttribute('data-list-type') || 'unordered') as 'ordered' | 'unordered';
    const level = parseInt(p.getAttribute('data-list-level') || '0', 10);

    if (!currentGroup || currentGroup.type !== type || currentGroup.level !== level) {
      currentGroup = { type, level, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(p);
  }

  // 为了简化嵌套处理，我们采用栈的方式重新构建列表结构
  // 先把所有列表段落替换为 li，再构建嵌套
  const liMap = new Map<HTMLElement, { type: 'ordered' | 'unordered'; level: number; li: HTMLLIElement }>();

  for (const p of listParagraphs) {
    const type = (p.getAttribute('data-list-type') || 'unordered') as 'ordered' | 'unordered';
    const level = parseInt(p.getAttribute('data-list-level') || '0', 10);

    // 提取内容（去掉 list-marker）
    const marker = p.querySelector('.list-marker');
    if (marker) marker.remove();

    // 创建 li，保留原段落的内联样式
    const li = doc.createElement('li');
    const style = p.getAttribute('style');
    if (style) li.setAttribute('style', style);

    // 保留 data-* 属性中与样式相关的
    ['data-margin-top', 'data-margin-bottom', 'data-line-height', 'data-text-indent', 'data-margin-left', 'data-margin-right']
      .forEach((attr) => {
        const val = p.getAttribute(attr);
        if (val) li.setAttribute(attr, val);
      });

    // 转移子元素
    while (p.firstChild) {
      li.appendChild(p.firstChild);
    }

    liMap.set(p, { type, level, li });
  }

  // 构建嵌套列表结构
  // 按文档顺序遍历，维护一个栈：[{level, listEl}]
  const stack: Array<{ level: number; listEl: HTMLOListElement | HTMLUListElement }> = [];

  for (const p of listParagraphs) {
    const info = liMap.get(p);
    if (!info) continue;
    const { type, level, li } = info;

    // 找到合适的父列表
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0 || stack[stack.length - 1].level < level) {
      // 需要创建新列表
      const listEl = type === 'ordered' ? doc.createElement('ol') : doc.createElement('ul');
      // 设置一些基础样式，避免被全局 CSS 过度覆盖
      listEl.setAttribute('data-imported-list', 'true');

      if (stack.length === 0) {
        // 顶层：替换原段落位置
        p.parentNode?.insertBefore(listEl, p);
      } else {
        // 嵌套：作为上一个 li 的子元素
        const parentList = stack[stack.length - 1].listEl;
        const lastLi = parentList.lastElementChild as HTMLLIElement;
        if (lastLi) {
          lastLi.appendChild(listEl);
        } else {
          // 异常情况，直接插入到段落前
          p.parentNode?.insertBefore(listEl, p);
        }
      }
      stack.push({ level, listEl });
    }

    // 将 li 加入当前列表
    stack[stack.length - 1].listEl.appendChild(li);
    // 删除原段落
    p.remove();
  }
}

/**
 * 标记导入的表格，避免编辑器默认 CSS 覆盖原始样式
 */
function markImportedTables(root: HTMLElement) {
  const tables = root.querySelectorAll('table');
  for (const table of Array.from(tables)) {
    // 添加标记，CSS 可通过 :not([data-imported="true"]) 排除这些表格
    table.setAttribute('data-imported', 'true');

    // 确保 td/th 的 border 样式尽量保留在 style 属性中
    const cells = table.querySelectorAll('td, th');
    for (const cell of Array.from(cells)) {
      // 如果单元格有 border 属性但没有 style 中的 border，同步到 style
      const borderAttr = cell.getAttribute('border');
      const style = cell.getAttribute('style') || '';
      if (borderAttr && !style.includes('border')) {
        cell.setAttribute('style', `${style}border:${borderAttr};`.trim());
      }
    }
  }
}

/**
 * 标准化图片样式
 * 确保 width/height 同时存在于 style 和属性中，便于 Tiptap Image 扩展解析
 */
function normalizeImageStyles(root: HTMLElement) {
  const images = root.querySelectorAll('img');
  for (const img of Array.from(images)) {
    const widthAttr = img.getAttribute('width');
    const heightAttr = img.getAttribute('height');
    let style = img.getAttribute('style') || '';

    if (widthAttr && !style.includes('width')) {
      style += `width:${widthAttr};`;
    }
    if (heightAttr && !style.includes('height')) {
      style += `height:${heightAttr};`;
    }

    // 提取 style 中的 width/height 到属性（Tiptap Image 扩展需要）
    const widthMatch = style.match(/width:\s*([^;]+)/);
    const heightMatch = style.match(/height:\s*([^;]+)/);

    if (widthMatch) {
      const val = widthMatch[1].trim();
      // 只设置纯数字或 px 值
      const numVal = parseInt(val, 10);
      if (!Number.isNaN(numVal)) {
        img.setAttribute('width', String(numVal));
      }
    }
    if (heightMatch) {
      const val = heightMatch[1].trim();
      const numVal = parseInt(val, 10);
      if (!Number.isNaN(numVal)) {
        img.setAttribute('height', String(numVal));
      }
    }

    if (style) {
      img.setAttribute('style', style);
    }
  }
}

/**
 * 清理不必要的空标签，但保留用于占位的空段落
 */
function cleanEmptyTags(root: HTMLElement) {
  // 保留空段落 <p><br></p> 或 <p></p>，因为 Word 中它们用于控制布局
  // 清理完全空的 span（没有 style 且没有内容）
  const emptySpans = Array.from(root.querySelectorAll('span')).filter((span) => {
    return !span.hasAttribute('style') && !span.textContent?.trim() && span.children.length === 0;
  });
  for (const span of emptySpans) {
    span.remove();
  }
}
