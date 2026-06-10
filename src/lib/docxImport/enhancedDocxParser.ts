import JSZip from 'jszip';
import {
  parseXml, childByTag, childrenByTag, wAttr, collectText,
} from './xmlUtils';
import {
  StyleResolver, parseParagraphProperties, parseRunProperties,
  parseTableProperties, parseTableCellProperties, InlineStyle,
} from './styleResolver';
import { NumberingResolver } from './numberingResolver';

export interface EnhancedDocxOptions {
  /** 是否将图片转为 Base64 DataURL */
  embedImages?: boolean;
  /** 是否保留原始样式ID */
  preserveStyleIds?: boolean;
  /** 是否解析页眉页脚 */
  parseHeadersFooters?: boolean;
  /** 是否解析文档设置 */
  parseSettings?: boolean;
}

export interface PageMargins {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface ParsedDocument {
  html: string;
  title: string | null;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
  styles: ParsedStyles;
  headersFooters?: HeadersFooters;
  pageMargins?: PageMargins;
}

export interface DocumentSection {
  type: 'cover' | 'usage' | 'toc' | 'body';
  title: string;
  level: number;
  html: string;
  pageBreak?: boolean;
}

export interface DocumentMetadata {
  author?: string;
  created?: string;
  modified?: string;
  lastModifiedBy?: string;
  revision?: number;
  title?: string;
  subject?: string;
  keywords?: string;
}

export interface ParsedStyles {
  paragraph: Map<string, unknown>;
  character: Map<string, unknown>;
  table: Map<string, unknown>;
  numbering: Map<string, unknown>;
}

export interface HeadersFooters {
  headers: Map<string, string>;
  footers: Map<string, string>;
}

interface RenderContext {
  styleResolver: StyleResolver;
  numberingResolver: NumberingResolver;
  images: Map<string, string>;
  rels: Map<string, string>;
  options: EnhancedDocxOptions;
}

/**
 * 增强的 DOCX 解析器
 * 支持更多格式特性
 */
export async function parseDocxEnhanced(
  input: Blob | ArrayBuffer | Uint8Array,
  options: EnhancedDocxOptions = {}
): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(input);

  // 读取核心 XML
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) throw new Error('Invalid DOCX: word/document.xml not found');

  const stylesXml = await zip.file('word/styles.xml')?.async('text');
  const numberingXml = await zip.file('word/numbering.xml')?.async('text');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text');
  const coreXml = await zip.file('docProps/core.xml')?.async('text');

  // 解析关系映射
  const rels = parseRels(relsXml);

  // 解析样式和编号
  const styleResolver = new StyleResolver(stylesXml);
  const numberingResolver = new NumberingResolver(numberingXml);

  // 读取图片
  const images = new Map<string, string>();
  if (options.embedImages !== false) {
    for (const [rId, target] of rels.entries()) {
      if (target.startsWith('media/')) {
        const ext = target.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        const data = await zip.file(`word/${target}`)?.async('base64');
        if (data) {
          images.set(rId, `data:${mime};base64,${data}`);
        }
      }
    }
  }

  // 解析文档主体
  const doc = parseXml(documentXml);
  const body = childByTag(doc.documentElement, 'body');
  if (!body) throw new Error('Invalid DOCX: body element not found');

  // 构建渲染上下文
  const ctx: RenderContext = {
    styleResolver,
    numberingResolver,
    images,
    rels,
    options,
  };

  // 提取页面设置（边距等）
  const sectPr = Array.from(body.children).find((n) => n.localName === 'sectPr');
  const pageMargins = extractPageMargins(sectPr);

  // 转换主体内容
  const htmlParts: string[] = [];
  const bodyChildren = Array.from(body.children).filter(
    (n) => n.localName !== 'sectPr'
  );

  for (const node of bodyChildren) {
    if (node.localName === 'p') {
      htmlParts.push(renderParagraphEnhanced(node, ctx));
    } else if (node.localName === 'tbl') {
      htmlParts.push(renderTableEnhanced(node, ctx));
    }
  }

  const fullHtml = htmlParts.join('');

  // 提取标题
  const title = extractTitle(bodyChildren, styleResolver);

  // 拆分章节
  const sections = splitIntoSections(fullHtml, title);
  const filteredHtml = sections.map((s) => s.html).join('');

  // 提取元数据
  const metadata = extractMetadata(coreXml);

  // 提取样式信息
  const styles = extractStyles();

  return {
    html: filteredHtml,
    title,
    sections,
    metadata,
    styles,
    pageMargins: pageMargins || undefined,
  };
}

/**
 * 增强的段落渲染
 */
function renderParagraphEnhanced(p: Element, ctx: RenderContext): string {
  const pPr = childByTag(p, 'pPr');
  const pStyleId = wAttr(childByTag(pPr, 'pStyle'), 'val') || 'Normal';
  const resolved = ctx.styleResolver.resolve(pStyleId);

  // 段落级内联样式
  const parsedPStyle = parseParagraphProperties(pPr);
  const pStyle: InlineStyle = { ...resolved.paragraph };
  // 只有当明确指定了属性时才覆盖
  if (parsedPStyle.textAlign) pStyle.textAlign = parsedPStyle.textAlign;
  if (parsedPStyle.lineHeight) pStyle.lineHeight = parsedPStyle.lineHeight;
  if (parsedPStyle.textIndent) pStyle.textIndent = parsedPStyle.textIndent;
  if (parsedPStyle.marginLeft) pStyle.marginLeft = parsedPStyle.marginLeft;
  if (parsedPStyle.marginRight) pStyle.marginRight = parsedPStyle.marginRight;
  if (parsedPStyle.marginTop) pStyle.marginTop = parsedPStyle.marginTop;
  if (parsedPStyle.marginBottom) pStyle.marginBottom = parsedPStyle.marginBottom;

  // 段落默认 run 属性
  const pDefaultRunStyle = parseRunProperties(childByTag(pPr, 'rPr'));
  const baseRunStyle = { ...resolved.run, ...pDefaultRunStyle };

  // 收集 runs
  const runsHtml = renderRunsEnhanced(p, ctx, baseRunStyle);

  // 分页符检测
  if (isPageBreakOnly(p)) {
    return '<div class="page-break" data-page-break="true"></div>';
  }

  // 构建 tag
  let tag = 'p';
  let innerHtml = runsHtml;
  
  // 合并段落样式和 run 样式（字体相关）到段落标签
  // 这样标题/段落元素本身就有 style 属性，CSS :not([style]) 不会匹配
  const mergedStyle: InlineStyle = { ...pStyle };
  if (baseRunStyle.fontFamily) mergedStyle.fontFamily = baseRunStyle.fontFamily;
  if (baseRunStyle.fontSize) mergedStyle.fontSize = baseRunStyle.fontSize;
  if (baseRunStyle.fontWeight) mergedStyle.fontWeight = baseRunStyle.fontWeight;
  if (baseRunStyle.fontStyle) mergedStyle.fontStyle = baseRunStyle.fontStyle;
  if (baseRunStyle.color) mergedStyle.color = baseRunStyle.color;
  
  const styleStr = inlineStyleToString(mergedStyle);

  // 构建 data 属性
  const dataAttrs: string[] = [];
  
  // 保留样式ID
  if (ctx.options.preserveStyleIds && pStyleId) {
    dataAttrs.push(`data-style-id="${escapeHtml(pStyleId)}"`);
  }

  // 段前段后间距
  if (pStyle.marginTop) {
    dataAttrs.push(`data-margin-top="${pStyle.marginTop}"`);
  }
  if (pStyle.marginBottom) {
    dataAttrs.push(`data-margin-bottom="${pStyle.marginBottom}"`);
  }

  // 行距
  if (pStyle.lineHeight) {
    dataAttrs.push(`data-line-height="${pStyle.lineHeight}"`);
  }

  // 缩进
  if (pStyle.textIndent) {
    dataAttrs.push(`data-text-indent="${pStyle.textIndent}"`);
  }
  if (pStyle.marginLeft) {
    dataAttrs.push(`data-margin-left="${pStyle.marginLeft}"`);
  }
  if (pStyle.marginRight) {
    dataAttrs.push(`data-margin-right="${pStyle.marginRight}"`);
  }

  // 编号/列表处理
  const numPr = childByTag(pPr, 'numPr');
  let numId: string | null = null;
  let ilvl: string | null = null;
  if (numPr) {
    numId = wAttr(childByTag(numPr, 'numId'), 'val');
    ilvl = wAttr(childByTag(numPr, 'ilvl'), 'val') || '0';
  } else if (resolved.numId) {
    numId = resolved.numId;
    ilvl = resolved.ilvl || '0';
  }

  if (numId && ilvl) {
    const isOrd = ctx.numberingResolver.isOrdered(numId, ilvl);
    const isUnord = ctx.numberingResolver.isUnordered(numId, ilvl);
    if (isOrd) {
      dataAttrs.push(`data-list-type="ordered" data-list-level="${ilvl}"`);
      innerHtml = `<span class="list-marker">${renderListMarker(numId, ilvl, ctx)}</span>${innerHtml}`;
    } else if (isUnord) {
      dataAttrs.push(`data-list-type="unordered" data-list-level="${ilvl}"`);
      innerHtml = `<span class="list-marker">•</span>${innerHtml}`;
    }
  }

  // heading 映射
  const outlineLvlEl = childByTag(pPr, 'outlineLvl');
  const outlineLvl = outlineLvlEl ? wAttr(outlineLvlEl, 'val') : null;
  const headingLevel = outlineLvl !== null
    ? Math.min(Math.max(parseInt(outlineLvl!, 10) + 1, 1), 6)
    : mapHeadingLevel(pStyleId);
  if (headingLevel) {
    tag = `h${headingLevel}`;
  }

  // 空段落处理
  if (!innerHtml) {
    innerHtml = '<br>';
    if (baseRunStyle.fontSize) {
      dataAttrs.push(`data-font-size="${baseRunStyle.fontSize}"`);
    }
  }

  // distribute 对齐（分散对齐）
  const rawJc = wAttr(childByTag(pPr, 'jc'), 'val');
  if (rawJc === 'distribute') {
    dataAttrs.push('data-text-align="distribute"');
    // 添加 CSS 样式实现分散对齐效果
    pStyle.textAlign = 'justify';
    // 使用 text-align-last: justify 让最后一行也分散对齐
    // 使用 text-justify: inter-ideograph 让中文字符正确分散
  }

  // 孤行控制
  const widowControl = wAttr(childByTag(pPr, 'widowControl'), 'val');
  if (widowControl) {
    dataAttrs.push(`data-widow-control="${widowControl}"`);
  }

  // 分页控制
  const pageBreakBefore = wAttr(childByTag(pPr, 'pageBreakBefore'), 'val');
  if (pageBreakBefore === 'true') {
    dataAttrs.push('data-page-break="before"');
  }

  const keepNext = wAttr(childByTag(pPr, 'keepNext'), 'val');
  if (keepNext === 'true') {
    dataAttrs.push('data-keep-next="true"');
  }

  const keepLines = wAttr(childByTag(pPr, 'keepLines'), 'val');
  if (keepLines === 'true') {
    dataAttrs.push('data-keep-lines="true"');
  }

  // 为 distribute 对齐添加特殊 class
  const classAttr = rawJc === 'distribute' ? ' class="text-distribute"' : '';
  const dataAttrStr = dataAttrs.length > 0 ? ' ' + dataAttrs.join(' ') : '';
  return `<${tag}${classAttr}${styleStr ? ` style="${styleStr}"` : ''}${dataAttrStr}>${innerHtml}</${tag}>`;
}

/**
 * 增强的表格渲染
 */
function renderTableEnhanced(tbl: Element, ctx: RenderContext): string {
  const tblPr = childByTag(tbl, 'tblPr');
  const tblStyleId = wAttr(childByTag(tblPr, 'tblStyle'), 'val');

  // 解析表格属性
  const tblStyle = parseTableProperties(tblPr);
  if (tblStyleId) {
    const resolved = ctx.styleResolver.resolveTable(tblStyleId);
    Object.assign(tblStyle, resolved.table);
  }

  // 构建表格属性
  const tableAttrs: string[] = [];
  
  if (tblStyle.width) {
    tableAttrs.push(`width="${tblStyle.width}"`);
  }
  if (tblStyle.border) {
    tableAttrs.push(`border="${tblStyle.border}"`);
  }

  const styleStr = inlineStyleToString(tblStyle);
  if (styleStr) {
    tableAttrs.push(`style="${styleStr}"`);
  }

  // 渲染表格内容
  let html = '<table' + (tableAttrs.length > 0 ? ' ' + tableAttrs.join(' ') : '') + '>';

  const rows = childrenByTag(tbl, 'tr');
  const rowCount = rows.length;
  
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const tr = rows[rowIndex];
    html += '<tr>';
    const cells = childrenByTag(tr, 'tc');
    const cellCount = cells.length;
    
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex++) {
      const tc = cells[cellIndex];
      const tcPr = childByTag(tc, 'tcPr');
      const cellStyle = parseTableCellProperties(tcPr);

      if (tblStyleId) {
        const resolved = ctx.styleResolver.resolveTable(tblStyleId);
        Object.assign(cellStyle, resolved.cell);
      }
      
      // 应用表格级别的内部边框到单元格
      if (tblStyle._insideH) {
        // 不是最后一行的单元格，添加下边框
        if (rowIndex < rowCount - 1) {
          cellStyle.borderBottom = tblStyle._insideH;
        }
      }
      if (tblStyle._insideV) {
        // 不是最后一列的单元格，添加右边框
        if (cellIndex < cellCount - 1) {
          cellStyle.borderRight = tblStyle._insideV;
        }
      }

      // 处理单元格合并
      const gridSpan = wAttr(childByTag(tcPr, 'gridSpan'), 'val');
      const vMerge = wAttr(childByTag(tcPr, 'vMerge'), 'val');

      const cellAttrs: string[] = [];
      
      if (gridSpan && parseInt(gridSpan, 10) > 1) {
        cellAttrs.push(`colspan="${gridSpan}"`);
      }
      
      // 垂直合并处理
      if (vMerge === 'restart') {
        // 计算 rowspan
        const rowspan = calculateRowspan(rows, tc, cells.indexOf(tc));
        if (rowspan > 1) {
          cellAttrs.push(`rowspan="${rowspan}"`);
        }
      } else if (vMerge !== null) {
        // 被合并的单元格，跳过渲染
        continue;
      }

      const cellStyleStr = inlineStyleToString(cellStyle);
      if (cellStyleStr) {
        cellAttrs.push(`style="${cellStyleStr}"`);
      }

      // 收集单元格内容
      const cellContent: string[] = [];
      for (const child of Array.from(tc.children)) {
        if (child.localName === 'p') {
          cellContent.push(renderParagraphEnhanced(child, ctx));
        } else if (child.localName === 'tbl') {
          cellContent.push(renderTableEnhanced(child, ctx));
        }
      }

      const tag = 'td'; // 简化处理，不区分 th
      html += `<${tag}${cellAttrs.length > 0 ? ' ' + cellAttrs.join(' ') : ''}>${cellContent.join('')}</${tag}>`;
    }
    html += '</tr>';
  }

  html += '</table>';

  // 封面表格特殊处理
  const hasTableBorder = !!(tblStyle.border || tblStyle.borderTop || tblStyle.borderBottom || tblStyle.borderLeft || tblStyle.borderRight);
  const hasCellBorder = rows.some((tr) => {
    return childrenByTag(tr, 'tc').some((tc) => {
      const tcPr = childByTag(tc, 'tcPr');
      const s = parseTableCellProperties(tcPr);
      if (tblStyleId) {
        const r = ctx.styleResolver.resolveTable(tblStyleId);
        Object.assign(s, r.cell);
      }
      return !!(s.border || s.borderTop || s.borderBottom || s.borderLeft || s.borderRight);
    });
  });

  if (!hasTableBorder && !hasCellBorder) {
    const cellTexts: string[] = [];
    rows.forEach((tr) => {
      childrenByTag(tr, 'tc').forEach((tc) => {
        cellTexts.push(collectText(tc));
      });
    });
    const joined = cellTexts.join('');
    if (/招标人/.test(joined) || /招标代理机构/.test(joined)) {
      const widthStr = tblStyle.width ? `width:${tblStyle.width};` : 'width:520px;';
      html = html.replace(
        '<table',
        `<table class="cover-table screen-only-border" style="border-collapse:collapse;${widthStr}margin-left:auto;margin-right:auto;"`
      );
    }
  }

  return html;
}

/**
 * 计算垂直合并的 rowspan
 */
function calculateRowspan(rows: Element[], currentCell: Element, cellIndex: number): number {
  let rowspan = 1;
  const currentRowIndex = rows.findIndex(row => 
    Array.from(row.children).includes(currentCell)
  );
  
  for (let i = currentRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = childrenByTag(row, 'tc');
    if (cellIndex < cells.length) {
      const cell = cells[cellIndex];
      const tcPr = childByTag(cell, 'tcPr');
      const vMerge = wAttr(childByTag(tcPr, 'vMerge'), 'val');
      if (vMerge !== null && vMerge !== 'restart') {
        rowspan++;
      } else {
        break;
      }
    }
  }
  
  return rowspan;
}

/**
 * 增强的 runs 渲染
 */
function renderRunsEnhanced(parent: Element, ctx: RenderContext, baseRunStyle: InlineStyle): string {
  let html = '';
  let currentText = '';
  let currentStyle = baseRunStyle;

  const flush = () => {
    if (currentText) {
      const styleStr = inlineStyleToString(currentStyle);
      const escaped = escapeHtml(currentText).replace(/ /g, '&nbsp;');
      html += styleStr
        ? `<span style="${styleStr}">${escaped}</span>`
        : escaped;
      currentText = '';
    }
  };

  for (const node of Array.from(parent.children)) {
    if (node.localName === 'r') {
      const rPr = childByTag(node, 'rPr');
      const parsedRunStyle = parseRunProperties(rPr);
      // 只有当 run 明确指定了属性时才覆盖，否则继承 baseRunStyle
      const runStyle = { ...baseRunStyle };
      if (parsedRunStyle.fontFamily) runStyle.fontFamily = parsedRunStyle.fontFamily;
      if (parsedRunStyle.fontSize) runStyle.fontSize = parsedRunStyle.fontSize;
      if (parsedRunStyle.fontWeight) runStyle.fontWeight = parsedRunStyle.fontWeight;
      if (parsedRunStyle.fontStyle) runStyle.fontStyle = parsedRunStyle.fontStyle;
      if (parsedRunStyle.textDecoration) runStyle.textDecoration = parsedRunStyle.textDecoration;
      if (parsedRunStyle.color) runStyle.color = parsedRunStyle.color;
      if (parsedRunStyle.verticalAlign) runStyle.verticalAlign = parsedRunStyle.verticalAlign;
      if (parsedRunStyle.backgroundColor) runStyle.backgroundColor = parsedRunStyle.backgroundColor;

      // 处理换页符
      const br = childByTag(node, 'br');
      if (br) {
        flush();
        const type = wAttr(br, 'type');
        if (type === 'page') {
          html += '<span class="page-break" data-page-break="true"></span>';
        } else {
          html += '<br>';
        }
        continue;
      }

      // 处理制表符
      const tab = childByTag(node, 'tab');
      if (tab) {
        flush();
        html += '&emsp;&emsp;';
        continue;
      }

      // 处理文本（一个 r 可能包含多个 t 元素）
      const tElements = childrenByTag(node, 't');
      for (const t of tElements) {
        const spacePreserve = t.getAttribute('xml:space') === 'preserve';
        let text = t.textContent || '';
        if (!spacePreserve) {
          text = text.replace(/\s+/g, ' ');
        }

        if (JSON.stringify(runStyle) !== JSON.stringify(currentStyle)) {
          flush();
          currentStyle = runStyle;
        }
        currentText += text;
      }

      // 处理图片
      const pict = childByTag(node, 'pict') || childByTag(node, 'drawing');
      if (pict) {
        flush();
        html += renderImage(pict, ctx);
      }
    } else if (node.localName === 'hyperlink') {
      flush();
      const rId = wAttr(node, 'id');
      const anchor = wAttr(node, 'anchor');
      const href = rId ? (ctx.rels.get(rId) || '#') : (anchor ? `#${anchor}` : '#');
      const linkText = collectText(node);
      html += `<a href="${escapeHtml(href)}" target="_blank">${escapeHtml(linkText)}</a>`;
    } else if (node.localName === 'bookmarkStart' || node.localName === 'bookmarkEnd') {
      // 书签标记，暂不处理
    } else if (node.localName === 'commentRangeStart' || node.localName === 'commentRangeEnd') {
      // 批注标记，暂不处理
    } else if (node.localName === 'del') {
      // 删除标记，提取其中的文本
      const delText = collectText(node);
      if (delText) {
        if (JSON.stringify(baseRunStyle) !== JSON.stringify(currentStyle)) {
          flush();
          currentStyle = baseRunStyle;
        }
        currentText += delText;
      }
    } else if (node.localName === 'ins') {
      // 插入标记，提取其中的文本
      const insText = collectText(node);
      if (insText) {
        if (JSON.stringify(baseRunStyle) !== JSON.stringify(currentStyle)) {
          flush();
          currentStyle = baseRunStyle;
        }
        currentText += insText;
      }
    } else if (node.localName === 'fldSimple') {
      // 简单域，提取其中的文本
      const fldText = collectText(node);
      if (fldText) {
        if (JSON.stringify(baseRunStyle) !== JSON.stringify(currentStyle)) {
          flush();
          currentStyle = baseRunStyle;
        }
        currentText += fldText;
      }
    }
  }

  flush();
  return html;
}

/**
 * 渲染图片
 */
function renderImage(pict: Element, ctx: RenderContext): string {
  // 查找 blip 元素（可能在 a:blip 或 blip）
  let blip: Element | null = null;
  
  // 尝试不同的方式查找 blip
  blip = pict.querySelector('blip');
  if (!blip) {
    // 遍历所有子元素查找 localName 为 blip 的元素
    const allElements = pict.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].localName === 'blip') {
        blip = allElements[i];
        break;
      }
    }
  }
  
  if (!blip) return '';

  // 获取 embed 属性（可能在 r:embed 或 embed）
  const embed = blip.getAttribute('r:embed') || blip.getAttribute('embed');
  if (!embed) return '';

  const dataUrl = ctx.images.get(embed);
  if (!dataUrl) return '';

  // 获取图片尺寸 - 查找 ext 元素 (DrawingML 中的 extent)
  let width = '';
  let height = '';
  
  // 尝试查找 ext 元素 (通常在 wp:extent 或 a:ext 中)
  const allElements = pict.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === 'ext') {
      const cx = el.getAttribute('cx');
      const cy = el.getAttribute('cy');
      if (cx) width = emuToPx(parseInt(cx, 10)) + 'px';
      if (cy) height = emuToPx(parseInt(cy, 10)) + 'px';
      if (width && height) break;
    }
  }

  // 检测 wp:anchor 的左侧定位（如封面 logo）
  const anchor = pict.querySelector('anchor');
  let isLeftAnchor = false;
  let marginTop = '';
  if (anchor) {
    const posH = anchor.querySelector('positionH');
    const align = posH?.querySelector('align')?.textContent;
    const posOffsetH = posH?.querySelector('posOffset')?.textContent;
    if (align === 'left') {
      isLeftAnchor = true;
    } else if (posOffsetH !== undefined && posOffsetH !== null) {
      const offset = parseInt(posOffsetH, 10);
      if (offset >= 0 && offset <= 200000) { // 约 0~21px，视为靠左
        isLeftAnchor = true;
      }
    }

    const posV = anchor.querySelector('positionV');
    const relativeFromV = posV?.getAttribute('relativeFrom');
    const posOffsetV = posV?.querySelector('posOffset')?.textContent;
    if (posOffsetV !== undefined && posOffsetV !== null && (relativeFromV === 'paragraph' || relativeFromV === 'line')) {
      const offset = emuToPx(parseInt(posOffsetV, 10));
      if (offset > 0) {
        marginTop = `${offset}px`;
      }
    }
  }

  const styleParts: string[] = [];
  if (isLeftAnchor) {
    styleParts.push('float:left');
    styleParts.push('margin:0 12px 0 0');
    if (marginTop) styleParts.push(`margin-top:${marginTop}`);
  } else {
    styleParts.push('display:block');
    styleParts.push('margin:0 auto');
  }
  if (width) styleParts.push(`width:${width}`);
  if (height) styleParts.push(`height:${height}`);
  const style = styleParts.length > 0 ? ` style="${styleParts.join(';')}"` : '';

  return `<img src="${dataUrl}"${style} data-image-id="${embed}"/>`;
}

// ─── 辅助函数 ───────────────────────────────────────────────────────────

function parseRels(relsXml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  const doc = parseXml(relsXml);
  const relEls = childrenByTag(doc.documentElement, 'Relationship');
  relEls.forEach((el) => {
    const id = el.getAttribute('Id');
    const target = el.getAttribute('Target');
    if (id && target) map.set(id, target);
  });
  return map;
}

function extractTitle(bodyChildren: Element[], styleResolver: StyleResolver): string | null {
  for (const node of bodyChildren) {
    if (node.localName === 'p') {
      const pPr = childByTag(node, 'pPr');
      const pStyleId = wAttr(childByTag(pPr, 'pStyle'), 'val') || 'Normal';
      styleResolver.resolve(pStyleId);
      const outlineLvlEl = childByTag(pPr, 'outlineLvl');
      const outlineLvl = outlineLvlEl ? wAttr(outlineLvlEl, 'val') : null;
      const headingLevel = outlineLvl !== null
        ? Math.min(Math.max(parseInt(outlineLvl!, 10) + 1, 1), 6)
        : mapHeadingLevel(pStyleId);
      if (headingLevel === 1) {
        const text = collectText(node).trim();
        if (text) return text;
      }
    }
  }
  return null;
}

function splitIntoSections(fullHtml: string, title: string | null): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const parts = fullHtml.split(/<h[1-6][^>]*>/i);
  
  if (parts[0].trim()) {
    sections.push({
      type: 'cover',
      title: title || '封面',
      level: 0,
      html: parts[0],
    });
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const endTagIndex = part.indexOf('</h');
    if (endTagIndex === -1) continue;

    const headingText = part.substring(0, endTagIndex).replace(/<[^>]+>/g, '').trim();
    const content = part.substring(endTagIndex);

    let type: DocumentSection['type'] = 'body';
    if (/使用说明|说明书/i.test(headingText)) {
      type = 'usage';
    } else if (/目录|contents/i.test(headingText)) {
      type = 'toc';
    } else if (/封面|cover/i.test(headingText)) {
      type = 'cover';
    }

    // 跳过目录，不导入
    if (type === 'toc') continue;

    sections.push({
      type,
      title: headingText,
      level: 1,
      html: `<h1>${headingText}</h1>${content}`,
    });
  }

  return sections;
}

function extractMetadata(coreXml: string | undefined): DocumentMetadata {
  const metadata: DocumentMetadata = {};

  if (coreXml) {
    const doc = parseXml(coreXml);
    const getText = (tagName: string) => {
      const el = doc.querySelector(tagName);
      return el?.textContent?.trim() || undefined;
    };

    metadata.author = getText('dc\\:creator') || getText('creator');
    metadata.created = getText('dcterms\\:created') || getText('created');
    metadata.modified = getText('dcterms\\:modified') || getText('modified');
    metadata.lastModifiedBy = getText('cp\\:lastModifiedBy') || getText('lastModifiedBy');
    metadata.title = getText('dc\\:title') || getText('title');
    metadata.subject = getText('dc\\:subject') || getText('subject');
    
    const keywords = getText('cp\\:keywords') || getText('keywords');
    if (keywords) metadata.keywords = keywords;

    const revision = getText('cp\\:revision') || getText('revision');
    if (revision) metadata.revision = parseInt(revision, 10);
  }

  return metadata;
}

function extractStyles(): ParsedStyles {
  return {
    paragraph: new Map(),
    character: new Map(),
    table: new Map(),
    numbering: new Map(),
  };
}

function extractPageMargins(sectPr: Element | undefined): PageMargins | null {
  if (!sectPr) return null;

  const pgMar = childByTag(sectPr, 'pgMar');
  if (!pgMar) return null;

  // 使用 wAttr 获取属性，支持带和不带 w: 前缀的属性名
  const top = parseInt(wAttr(pgMar, 'top') || '1440', 10);
  const right = parseInt(wAttr(pgMar, 'right') || '1440', 10);
  const bottom = parseInt(wAttr(pgMar, 'bottom') || '1440', 10);
  const left = parseInt(wAttr(pgMar, 'left') || '1440', 10);

  return {
    top: twipsToPx(top) + 'px',
    right: twipsToPx(right) + 'px',
    bottom: twipsToPx(bottom) + 'px',
    left: twipsToPx(left) + 'px',
  };
}

function isPageBreakOnly(p: Element): boolean {
  const runs = childrenByTag(p, 'r');
  if (runs.length !== 1) return false;
  const r = runs[0];
  const br = childByTag(r, 'br');
  if (!br) return false;
  const type = wAttr(br, 'type');
  return type === 'page';
}

function mapHeadingLevel(styleId: string): number | null {
  const s = styleId.toLowerCase();
  if (s.includes('heading1') || s.includes('标题1')) return 1;
  if (s.includes('heading2') || s.includes('标题2')) return 2;
  if (s.includes('heading3') || s.includes('标题3')) return 3;
  if (s.includes('heading4') || s.includes('标题4')) return 4;
  if (s.includes('heading5') || s.includes('标题5')) return 5;
  if (s.includes('heading6') || s.includes('标题6')) return 6;
  return null;
}

function renderListMarker(numId: string, ilvl: string, ctx: RenderContext): string {
  const lvlText = ctx.numberingResolver.getLevelText(numId, ilvl);
  if (lvlText) {
    return lvlText.replace(/%\d+/g, '1') + '.';
  }
  return '1.';
}

// ─── 单位转换 ───────────────────────────────────────────────────────────

function twipsToPx(twips: number): number {
  return Math.round((twips / 1440) * 96);
}

function emuToPx(emu: number): number {
  return Math.round((emu / 914400) * 96);
}

// ─── HTML 转义 ───────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── 样式转换 ───────────────────────────────────────────────────────────

function inlineStyleToString(style: InlineStyle): string {
  const parts: string[] = [];
  if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.fontStyle) parts.push(`font-style:${style.fontStyle}`);
  if (style.textDecoration) parts.push(`text-decoration:${style.textDecoration}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.lineHeight) parts.push(`line-height:${style.lineHeight}`);
  if (style.textIndent) parts.push(`text-indent:${style.textIndent}`);
  if (style.marginLeft) parts.push(`margin-left:${style.marginLeft}`);
  if (style.marginRight) parts.push(`margin-right:${style.marginRight}`);
  if (style.marginTop) parts.push(`margin-top:${style.marginTop}`);
  if (style.marginBottom) parts.push(`margin-bottom:${style.marginBottom}`);
  if (style.border) parts.push(`border:${style.border}`);
  if (style.borderTop) parts.push(`border-top:${style.borderTop}`);
  if (style.borderBottom) parts.push(`border-bottom:${style.borderBottom}`);
  if (style.borderLeft) parts.push(`border-left:${style.borderLeft}`);
  if (style.borderRight) parts.push(`border-right:${style.borderRight}`);
  if (style.verticalAlign) parts.push(`vertical-align:${style.verticalAlign}`);
  if (style.width) parts.push(`width:${style.width}`);
  if (style.backgroundColor) parts.push(`background-color:${style.backgroundColor}`);
  return parts.join(';');
}
