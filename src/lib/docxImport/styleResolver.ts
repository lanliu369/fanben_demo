import { parseXml, childByTag, childrenByTag, wAttr } from './xmlUtils';

/**
 * 内联样式属性集合
 */
export interface InlineStyle {
  fontFamily?: string;
  fontSize?: string;        // px
  fontWeight?: 'normal' | 'bold' | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  textIndent?: string;
  marginLeft?: string;
  marginRight?: string;
  marginTop?: string;
  marginBottom?: string;
  border?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
  verticalAlign?: string;
  width?: string;
  backgroundColor?: string;
  // 表格内部边框（临时存储）
  _insideH?: string;
  _insideV?: string;
}

/**
 * 段落样式 + 文本样式组合
 */
export interface TableStyle {
  table: InlineStyle;
  cell: InlineStyle;
  basedOn?: string;
}

export interface ResolvedStyle {
  paragraph: InlineStyle;
  run: InlineStyle;
  numId?: string;
  ilvl?: string;
  basedOn?: string;
  styleId?: string;
}

/**
 * 样式解析器：读取 styles.xml，建立 styleId → ResolvedStyle 映射
 */
export class StyleResolver {
  private styles = new Map<string, ResolvedStyle>();
  private tableStyles = new Map<string, TableStyle>();

  constructor(stylesXml: string | null | undefined) {
    if (stylesXml) {
      this.loadStyles(stylesXml);
    }
  }

  private loadStyles(xml: string) {
    const doc = parseXml(xml);
    const styleEls = childrenByTag(doc.documentElement, 'style');
    styleEls.forEach((el) => {
      const styleId = attr(el, 'styleId') ?? '';
      if (!styleId) return;
      const type = attr(el, 'type');
      if (type === 'table') {
        this.tableStyles.set(styleId, this.parseTableStyleElement(el));
      } else {
        this.styles.set(styleId, this.parseStyleElement(el));
      }
    });
  }

  private parseStyleElement(el: Element): ResolvedStyle {
    const basedOn = wAttr(childByTag(el, 'basedOn'), 'val') ?? undefined;
    const pPr = childByTag(el, 'pPr');
    const rPr = childByTag(el, 'rPr');
    const paragraph = pPr ? parseParagraphProperties(pPr) : {};
    const run = rPr ? parseRunProperties(rPr) : {};

    const numPr = childByTag(el, 'numPr');
    let numId: string | undefined;
    let ilvl: string | undefined;
    if (numPr) {
      numId = wAttr(childByTag(numPr, 'numId'), 'val') ?? undefined;
      ilvl = wAttr(childByTag(numPr, 'ilvl'), 'val') ?? undefined;
    }

    return { paragraph, run, numId, ilvl, basedOn, styleId: attr(el, 'styleId') ?? undefined };
  }

  private parseTableStyleElement(el: Element): TableStyle {
    const basedOn = wAttr(childByTag(el, 'basedOn'), 'val') ?? undefined;
    const tblPr = childByTag(el, 'tblPr');
    const tcPr = childByTag(el, 'tcPr');
    return {
      table: tblPr ? parseTableProperties(tblPr) : {},
      cell: tcPr ? parseTableCellProperties(tcPr) : {},
      basedOn,
    };
  }

  /**
   * 获取表格样式的最终内联样式（递归解析 basedOn 继承）
   */
  resolveTable(styleId: string): { table: InlineStyle; cell: InlineStyle } {
    const result: { table: InlineStyle; cell: InlineStyle } = { table: {}, cell: {} };
    this.mergeTableStyle(styleId, result, new Set());
    return result;
  }

  private mergeTableStyle(styleId: string, target: { table: InlineStyle; cell: InlineStyle }, visited: Set<string>) {
    if (visited.has(styleId)) return;
    visited.add(styleId);
    const style = this.tableStyles.get(styleId);
    if (!style) return;
    Object.assign(target.table, style.table);
    Object.assign(target.cell, style.cell);
    if (style.basedOn) {
      this.mergeTableStyle(style.basedOn, target, visited);
    }
  }

  /**
   * 获取指定样式的最终内联样式（递归解析 basedOn 继承）
   */
  resolve(styleId: string): { paragraph: InlineStyle; run: InlineStyle; numId?: string; ilvl?: string } {
    const result: { paragraph: InlineStyle; run: InlineStyle; numId?: string; ilvl?: string } = {
      paragraph: {},
      run: {},
    };
    this.mergeStyle(styleId, result, new Set());
    return result;
  }

  private mergeStyle(styleId: string, target: { paragraph: InlineStyle; run: InlineStyle; numId?: string; ilvl?: string }, visited: Set<string>) {
    if (visited.has(styleId)) return;
    visited.add(styleId);
    const style = this.styles.get(styleId);
    if (!style) return;

    // 先递归应用父样式（basedOn），确保子样式可以覆盖父样式
    if (style.basedOn) {
      this.mergeStyle(style.basedOn, target, visited);
    }

    // 然后应用当前样式，覆盖父样式
    Object.assign(target.paragraph, style.paragraph);
    Object.assign(target.run, style.run);
    if (style.numId) target.numId = style.numId;
    if (style.ilvl) target.ilvl = style.ilvl;
  }
}

function attr(el: Element | null | undefined, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}

// ─── 段落属性解析 ───────────────────────────────────────────────────────────

export function parseParagraphProperties(pPr: Element | null | undefined): InlineStyle {
  const style: InlineStyle = {};
  const alignValues = new Set(['left', 'center', 'right', 'justify']);

  // 对齐
  const jc = wAttr(childByTag(pPr, 'jc'), 'val');
  if (jc) {
    const map: Record<string, string> = {
      left: 'left', center: 'center', right: 'right', both: 'justify',
      distribute: 'justify', start: 'left', end: 'right',
    };
    const normalized = map[jc] || jc;
    if (alignValues.has(normalized)) {
      style.textAlign = normalized as InlineStyle['textAlign'];
    }
  }

  // 缩进
  const ind = childByTag(pPr, 'ind');
  if (ind) {
    const firstLine = wAttr(ind, 'firstLine');
    const left = wAttr(ind, 'left');
    const right = wAttr(ind, 'right');
    if (firstLine) style.textIndent = twipsToCm(parseInt(firstLine, 10));
    if (left) style.marginLeft = twipsToCm(parseInt(left, 10));
    if (right) style.marginRight = twipsToCm(parseInt(right, 10));
  }

  // 段前段后间距
  const spacing = childByTag(pPr, 'spacing');
  if (spacing) {
    const before = wAttr(spacing, 'before');
    const after = wAttr(spacing, 'after');
    const line = wAttr(spacing, 'line');
    const lineRule = wAttr(spacing, 'lineRule');
    if (before) style.marginTop = twipsToPx(parseInt(before, 10)) + 'px';
    if (after) style.marginBottom = twipsToPx(parseInt(after, 10)) + 'px';
    if (line) {
      if (lineRule === 'exact') {
        style.lineHeight = twipsToPx(parseInt(line, 10)) + 'px';
      } else if (lineRule === 'atLeast') {
        style.lineHeight = twipsToPx(parseInt(line, 10)) + 'px';
      } else {
        // auto 倍数：line / 240
        const ratio = parseInt(line, 10) / 240;
        style.lineHeight = ratio.toFixed(2);
      }
    }
  }

  // 段落底边框（目录虚线等）
  const pBdr = childByTag(pPr, 'pBdr');
  if (pBdr) {
    const bottom = childByTag(pBdr, 'bottom');
    if (bottom) {
      const borderStr = parseBorder(bottom);
      if (borderStr) style.borderBottom = borderStr;
    }
  }

  return style;
}

// ─── 文本属性解析 ───────────────────────────────────────────────────────────

export function parseRunProperties(rPr: Element | null | undefined): InlineStyle {
  const style: InlineStyle = {};

  // 字体
  const rFonts = childByTag(rPr, 'rFonts');
  if (rFonts) {
    const eastAsia = attr(rFonts, 'eastAsia') ?? attr(rFonts, 'w:eastAsia');
    const ascii = attr(rFonts, 'ascii') ?? attr(rFonts, 'w:ascii');
    const hAnsi = attr(rFonts, 'hAnsi') ?? attr(rFonts, 'w:hAnsi');
    const font = eastAsia || ascii || hAnsi;
    if (font) style.fontFamily = font;
  }

  // 字号（half-points）
  const sz = wAttr(childByTag(rPr, 'sz'), 'val') ?? wAttr(childByTag(rPr, 'szCs'), 'val');
  if (sz) {
    const halfPoints = parseInt(sz, 10);
    style.fontSize = halfPointsToPx(halfPoints) + 'px';
  }

  // 加粗
  const b = childByTag(rPr, 'b');
  if (b) {
    const val = wAttr(b, 'val');
    if (val === '0' || val === 'false') {
      // 显式取消加粗
    } else {
      style.fontWeight = 'bold';
    }
  }

  // 斜体
  const i = childByTag(rPr, 'i');
  if (i) {
    const val = wAttr(i, 'val');
    if (val !== '0' && val !== 'false') {
      style.fontStyle = 'italic';
    }
  }

  // 下划线
  const u = childByTag(rPr, 'u');
  if (u) {
    const val = wAttr(u, 'val');
    if (val && val !== 'none') {
      style.textDecoration = 'underline';
    }
  }

  // 颜色
  const color = wAttr(childByTag(rPr, 'color'), 'val');
  if (color && color !== 'auto') {
    style.color = '#' + color;
  }

  // 垂直对齐（上标/下标）
  const vertAlign = wAttr(childByTag(rPr, 'vertAlign'), 'val');
  if (vertAlign) {
    if (vertAlign === 'superscript') style.verticalAlign = 'super';
    if (vertAlign === 'subscript') style.verticalAlign = 'sub';
  }

  // 高亮/底纹
  const highlight = wAttr(childByTag(rPr, 'highlight'), 'val');
  if (highlight && highlight !== 'none') {
    style.backgroundColor = highlightColorToCss(highlight);
  }
  const shd = childByTag(rPr, 'shd');
  if (shd) {
    const fill = wAttr(shd, 'fill');
    if (fill && fill !== 'auto') style.backgroundColor = '#' + fill;
  }

  return style;
}

// ─── 表格属性解析 ───────────────────────────────────────────────────────────

export function parseTableProperties(tblPr: Element | null | undefined): InlineStyle {
  const style: InlineStyle = {};
  const alignValues = new Set(['left', 'center', 'right', 'justify']);

  const tblW = childByTag(tblPr, 'tblW');
  if (tblW) {
    const w = wAttr(tblW, 'w');
    const type = wAttr(tblW, 'type');
    if (w) {
      if (type === 'pct') {
        style.width = (parseInt(w, 10) / 50) + '%';
      } else {
        style.width = twipsToPx(parseInt(w, 10)) + 'px';
      }
    }
  }

  const jc = wAttr(childByTag(tblPr, 'jc'), 'val');
  if (jc) {
    if (jc === 'center') {
      style.marginLeft = 'auto';
      style.marginRight = 'auto';
    } else {
      const map: Record<string, string> = { left: 'left', right: 'right' };
      const normalized = map[jc] || jc;
      if (alignValues.has(normalized)) {
        style.textAlign = normalized as InlineStyle['textAlign'];
      }
    }
  }

  const tblBorders = childByTag(tblPr, 'tblBorders');
  if (tblBorders) {
    const top = parseBorder(childByTag(tblBorders, 'top'));
    const left = parseBorder(childByTag(tblBorders, 'left'));
    const bottom = parseBorder(childByTag(tblBorders, 'bottom'));
    const right = parseBorder(childByTag(tblBorders, 'right'));
    const insideH = parseBorder(childByTag(tblBorders, 'insideH'));
    const insideV = parseBorder(childByTag(tblBorders, 'insideV'));

    // 简化处理：如果所有边框一致，用 border 简写；否则分别设置
    if (top && top === left && left === bottom && bottom === right) {
      style.border = top;
    } else {
      if (top) style.borderTop = top;
      if (left) style.borderLeft = left;
      if (bottom) style.borderBottom = bottom;
      if (right) style.borderRight = right;
    }
    
    // 保存内部边框供单元格使用
    if (insideH) style._insideH = insideH;
    if (insideV) style._insideV = insideV;
  }

  // 可扩展：根据 childByTag(tblPr, 'tblLook') 判断是否显示边框

  return style;
}

export function parseTableCellProperties(tcPr: Element | null | undefined): InlineStyle {
  const style: InlineStyle = {};

  const tcW = childByTag(tcPr, 'tcW');
  if (tcW) {
    const w = wAttr(tcW, 'w');
    if (w) style.width = twipsToPx(parseInt(w, 10)) + 'px';
  }

  const vAlign = wAttr(childByTag(tcPr, 'vAlign'), 'val');
  if (vAlign) {
    const map: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };
    style.verticalAlign = map[vAlign] || vAlign;
  }

  const tcBorders = childByTag(tcPr, 'tcBorders');
  if (tcBorders) {
    const top = parseBorder(childByTag(tcBorders, 'top'));
    const left = parseBorder(childByTag(tcBorders, 'left'));
    const bottom = parseBorder(childByTag(tcBorders, 'bottom'));
    const right = parseBorder(childByTag(tcBorders, 'right'));
    if (top) style.borderTop = top;
    if (left) style.borderLeft = left;
    if (bottom) style.borderBottom = bottom;
    if (right) style.borderRight = right;
  }

  const shd = childByTag(tcPr, 'shd');
  if (shd) {
    const fill = wAttr(shd, 'fill');
    if (fill && fill !== 'auto') style.backgroundColor = '#' + fill;
  }

  // gridSpan 在 HTML 中用 colspan，在 table 转换层处理，这里不放在 style 里

  return style;
}

// ─── 边框解析 ───────────────────────────────────────────────────────────────

export function parseBorder(borderEl: Element | null | undefined): string | null {
  if (!borderEl) return null;
  const val = wAttr(borderEl, 'val');
  if (!val || val === 'none' || val === 'nil') return null;

  const sz = wAttr(borderEl, 'sz');           // 八分之一磅
  const color = wAttr(borderEl, 'color');

  let width = '1px';
  if (sz) {
    const points = parseInt(sz, 10) / 8;
    width = pointsToPx(points) + 'px';
  }

  let styleType = 'solid';
  if (val === 'dashed' || val === 'dashSmallGap') styleType = 'dashed';
  else if (val === 'dotted') styleType = 'dotted';
  else if (val === 'double') styleType = 'double';
  else if (val === 'single') styleType = 'solid';

  const colorStr = (color && color !== 'auto') ? '#' + color : '#000000';
  return `${width} ${styleType} ${colorStr}`;
}

// ─── 单位换算 ───────────────────────────────────────────────────────────────

function halfPointsToPx(hp: number): number {
  const pt = hp / 2;
  return Math.round(pt * 1.3333 * 10) / 10; // 1pt ≈ 1.3333px
}

function pointsToPx(pt: number): number {
  return Math.round(pt * 1.3333 * 10) / 10;
}

function twipsToPx(twips: number): number {
  return Math.round((twips / 1440) * 96 * 10) / 10;
}

function twipsToCm(twips: number): string {
  const cm = (twips / 1440) * 2.54;
  return cm.toFixed(2) + 'cm';
}

function highlightColorToCss(color: string): string {
  const map: Record<string, string> = {
    yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff',
    magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
    darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000',
    darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000',
    darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000',
  };
  return map[color] || color;
}
