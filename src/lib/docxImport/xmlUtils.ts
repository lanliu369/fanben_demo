/**
 * XML 命名空间定义（Open XML WordprocessingML）
 */
export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
} as const;

/**
 * 安全解析 XML（浏览器 DOMParser 可用）
 */
export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/**
 * 按 localName 查询第一个子元素（忽略命名空间前缀）
 */
export function childByTag(parent: Element | null | undefined, localName: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) {
      return parent.children[i];
    }
  }
  return null;
}

/**
 * 按 localName 查询所有直接子元素
 */
export function childrenByTag(parent: Element | null | undefined, localName: string): Element[] {
  if (!parent) return [];
  const out: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) {
      out.push(parent.children[i]);
    }
  }
  return out;
}

/**
 * 获取元素的属性值
 */
export function attr(el: Element | null | undefined, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}

/**
 * 获取带 w: 前缀的属性（Open XML 中常见）
 * 注意：实际 DOM 中属性名可能是 val 或 w:val，取决于解析器是否保留前缀
 */
export function wAttr(el: Element | null | undefined, localName: string): string | null {
  return attr(el, localName) ?? attr(el, `w:${localName}`);
}

/**
 * 从文本节点收集纯文本（递归）
 */
export function collectText(node: Node | null | undefined): string {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  let text = '';
  node.childNodes.forEach((child) => {
    text += collectText(child);
  });
  return text;
}
