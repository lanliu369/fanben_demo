import JSZip from 'jszip';
import {
  parseXml, childByTag, childrenByTag, wAttr, collectText,
} from './xmlUtils';
import {
  StyleResolver, parseParagraphProperties, parseRunProperties,
  parseTableProperties, parseTableCellProperties, InlineStyle,
} from './styleResolver';
import { NumberingResolver } from './numberingResolver';

export interface DocxToHtmlOptions {
  /** 是否将图片转为 Base64 DataURL */
  embedImages?: boolean;
}

export interface DocxToHtmlResult {
  html: string;
  title: string | null;
  sections: DocxSection[];
}

export interface DocxSection {
  type: 'cover' | 'usage' | 'toc' | 'body';
  title: string;
  level: number;
  html: string;
}

/**
 * 将 DOCX 文件（Blob/Buffer/ArrayBuffer）转换为高保真 HTML
 */
export async function docxToHtml(
  input: Blob | ArrayBuffer | Uint8Array,
  options: DocxToHtmlOptions = {}
): Promise<DocxToHtmlResult> {
  const zip = await JSZip.loadAsync(input);

  // ── 读取核心 XML ──
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) throw new Error('Invalid DOCX: word/document.xml not found');

  const stylesXml = await zip.file('word/styles.xml')?.async('text');
  const numberingXml = await zip.file('word/numbering.xml')?.async('text');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text');

  // ── 解析关系映射（用于图片）──
  const rels = parseRels(relsXml);

  // ── 解析样式和编号 ──
  const styleResolver = new StyleResolver(stylesXml);
  const numberingResolver = new NumberingResolver(numberingXml);

  // ── 读取图片为 Base64 ──
  const images = new Map<string, string>(); // target -> dataUrl
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

  // ── 转换主体 ──
  const doc = parseXml(documentXml);
  const body = childByTag(doc.documentElement, 'body');
  if (!body) throw new Error('Invalid DOCX: body element not found');

  const htmlParts: string[] = [];
  const bodyChildren = Array.from(body.children).filter(
    (n) => n.localName !== 'sectPr'
  );

  for (const node of bodyChildren) {
    if (node.localName === 'p') {
      htmlParts.push(renderParagraph(node, { styleResolver, numberingResolver, images, rels }));
    } else if (node.localName === 'tbl') {
      htmlParts.push(renderTable(node, { styleResolver, numberingResolver, images, rels }));
    }
  }

  const fullHtml = htmlParts.join('');

  // ── 提取标题（第一个 heading）──
  const title = extractTitle(bodyChildren);

  // ── 按业务拆分 Section（封面/使用说明/目录/正文）──
  const sections = splitIntoSections(fullHtml);
  const filteredHtml = sections.map((s) => s.html).join('');

  return { html: filteredHtml, title, sections };
}

// ─────────────────────────────────────────────────────────────────────────────
// 段落渲染
// ─────────────────────────────────────────────────────────────────────────────

interface RenderContext {
  styleResolver: StyleResolver;
  numberingResolver: NumberingResolver;
  images: Map<string, string>;
  rels: Map<string, string>;
}

function renderParagraph(p: Element, ctx: RenderContext): string {
  const pPr = childByTag(p, 'pPr');
  const pStyleId = wAttr(childByTag(pPr, 'pStyle'), 'val') || 'Normal';
  const resolved = ctx.styleResolver.resolve(pStyleId);

  // 段落级内联样式：pPr 覆盖样式定义
  const pStyle = { ...resolved.paragraph, ...parseParagraphProperties(pPr) };

  // 段落默认 run 属性（pPr 下的 rPr）会影响空段落高度和 run 继承
  const pDefaultRunStyle = parseRunProperties(childByTag(pPr, 'rPr'));
  const baseRunStyle = { ...resolved.run, ...pDefaultRunStyle };

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

  // 收集 runs
  const runsHtml = renderRuns(p, ctx, baseRunStyle);

  // 分页符检测：段落内仅包含一个分页符且无文本
  if (isPageBreakOnly(p)) {
    return '<div class="page-break"></div>';
  }

  // 构建 tag
  let tag = 'p';
  let innerHtml = runsHtml;
  let styleStr = inlineStyleToString(pStyle);

  // 如果是有序/无序列表，先简化为 p（后续分块层可进一步处理为 li/ol/ul）
  // 这里保留 p + class，便于前端识别
  if (numId && ilvl) {
    const isOrd = ctx.numberingResolver.isOrdered(numId, ilvl);
    const isUnord = ctx.numberingResolver.isUnordered(numId, ilvl);
    if (isOrd) {
      styleStr += (styleStr ? ';' : '') + 'margin-left:' + (parseInt(ilvl, 10) * 0.74 + 'cm');
      innerHtml = `<span class="list-marker">${renderListMarker(numId, ilvl, ctx)}</span>${innerHtml}`;
    } else if (isUnord) {
      styleStr += (styleStr ? ';' : '') + 'margin-left:' + (parseInt(ilvl, 10) * 0.74 + 'cm');
      innerHtml = `<span class="list-marker">•</span>${innerHtml}`;
    }
  }

  // heading 映射：优先使用 outlineLvl（更准确），再使用 pStyle 样式名
  const outlineLvlEl = childByTag(pPr, 'outlineLvl');
  const outlineLvl = outlineLvlEl ? wAttr(outlineLvlEl, 'val') : null;
  const headingLevel = outlineLvl !== null
    ? Math.min(Math.max(parseInt(outlineLvl!, 10) + 1, 1), 6)
    : mapHeadingLevel(pStyleId);
  if (headingLevel) {
    tag = `h${headingLevel}`;
  }

  // 空段落必须包含 <br> 才能让倍数 line-height 生效（Word 中空段落通常用于占位）
  // 同时注入段落默认字号，确保空段落高度与 Word 一致
  if (!innerHtml) {
    innerHtml = '<br>';
    if (baseRunStyle.fontSize) {
      styleStr += (styleStr ? ';' : '') + 'font-size:' + baseRunStyle.fontSize;
    }
  }

  // distribute 对齐补充 CSS
  const rawJc = wAttr(childByTag(pPr, 'jc'), 'val');
  if (rawJc === 'distribute') {
    styleStr += (styleStr ? ';' : '') + 'text-align-last:justify;text-justify:inter-ideograph';
  }

  return `<${tag}${styleStr ? ` style="${styleStr}"` : ''}>${innerHtml}</${tag}>`;
}

function renderRuns(parent: Element, ctx: RenderContext, baseRunStyle: InlineStyle): string {
  let html = '';
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === 'r') {
      html += renderRun(child, ctx, baseRunStyle);
    } else if (child.localName === 'hyperlink') {
      const anchor = wAttr(child, 'anchor');
      const rId = attr(child, 'id'); // 关系 ID
      const href = anchor ? `#${anchor}` : '#';
      if (rId && ctx.rels.has(rId)) {
        // 外部链接通常在 document.xml.rels 中类型为 Hyperlink
        // 这里简单保留 anchor
      }
      const linkRuns = renderRuns(child, ctx, baseRunStyle);
      html += `<a href="${href}">${linkRuns}</a>`;
    } else if (child.localName === 'bookmarkStart' || child.localName === 'bookmarkEnd') {
      // 忽略书签标记
    }
  }
  return html;
}

function renderRun(r: Element, ctx: RenderContext, baseRunStyle: InlineStyle): string {
  const rPr = childByTag(r, 'rPr');
  const runStyle = { ...baseRunStyle, ...parseRunProperties(rPr) };
  const styleStr = inlineStyleToString(runStyle);

  const parts: string[] = [];
  for (let i = 0; i < r.children.length; i++) {
    const c = r.children[i];
    if (c.localName === 't') {
      // 将普通空格替换为 &nbsp;，防止 HTML 折叠连续空格
      // 这对 Word 中靠空格实现的下划线/对齐效果至关重要
      parts.push(escapeHtml(c.textContent || '').replace(/ /g, '&nbsp;'));
    } else if (c.localName === 'tab') {
      parts.push('&emsp;&emsp;');
    } else if (c.localName === 'br') {
      const type = wAttr(c, 'type');
      if (type === 'page') {
        // 分页符在 paragraph 层统一处理
      } else {
        parts.push('<br>');
      }
    } else if (c.localName === 'lastRenderedPageBreak') {
      // 忽略自动分页标记
    } else if (c.localName === 'drawing') {
      const img = renderDrawing(c, ctx);
      if (img) parts.push(img);
    } else if (c.localName === 'pict') {
      const img = renderPict(c, ctx);
      if (img) parts.push(img);
    }
  }

  if (parts.length === 0) return '';

  // 单独一张图片，直接返回
  if (parts.length === 1 && parts[0].startsWith('<img')) {
    return parts[0];
  }

  // 混合内容时：文本包在 span 里，img/br 不包
  if (styleStr) {
    const result: string[] = [];
    let textBuf: string[] = [];
    const flushText = () => {
      if (textBuf.length) {
        result.push(`<span style="${styleStr}">${textBuf.join('')}</span>`);
        textBuf = [];
      }
    };
    parts.forEach((part) => {
      if (part.startsWith('<img') || part === '<br>') {
        flushText();
        result.push(part);
      } else {
        textBuf.push(part);
      }
    });
    flushText();
    return result.join('');
  }

  return parts.join('');
}

function renderDrawing(drawing: Element, ctx: RenderContext): string {
  const anchor = drawing.querySelector('anchor');

  // 查找 a:blip 的 r:embed
  const blip = drawing.querySelector('blip');
  if (!blip) return '';
  const embed = blip.getAttribute('r:embed') || blip.getAttribute('embed');
  if (!embed || !ctx.images.has(embed)) return '';

  // 查找尺寸（EMUs: 914400 per inch）
  const extent = drawing.querySelector('extent');
  let width: number | undefined;
  let height: number | undefined;
  if (extent) {
    const cx = extent.getAttribute('cx');
    const cy = extent.getAttribute('cy');
    if (cx) width = Math.round(parseInt(cx, 10) / 914400 * 96);
    if (cy) height = Math.round(parseInt(cy, 10) / 914400 * 96);
  }

  const src = ctx.images.get(embed)!;
  const wAttr = width ? ` width="${width}"` : '';
  const hAttr = height ? ` height="${height}"` : '';

  // 检测左侧定位的 anchor 图片（如封面 logo）
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
      const offset = Math.round(parseInt(posOffsetV, 10) / 914400 * 96);
      if (offset > 0) {
        marginTop = `${offset}px`;
      }
    }
  }

  if (isLeftAnchor) {
    const mt = marginTop ? `margin-top:${marginTop};` : '';
    return `<img src="${src}"${wAttr}${hAttr} style="float:left;margin:0 12px 0 0;${mt}">`;
  }

  return `<img src="${src}"${wAttr}${hAttr} style="display:block;margin:0 auto;">`;
}

function renderPict(pict: Element, ctx: RenderContext): string {
  // VML 图片（旧格式）：简单查找 imagedata 的 r:id
  const imagedata = pict.querySelector('imagedata');
  if (!imagedata) return '';
  const id = imagedata.getAttribute('r:id') || imagedata.getAttribute('id');
  if (!id || !ctx.images.has(id)) return '';
  const src = ctx.images.get(id)!;
  return `<img src="${src}" style="display:block;margin:0 auto;">`;
}

function isPageBreakOnly(p: Element): boolean {
  const runs = childrenByTag(p, 'r');
  if (runs.length !== 1) return false;
  const r = runs[0];
  for (let i = 0; i < r.children.length; i++) {
    const c = r.children[i];
    if (c.localName === 'br') {
      const type = wAttr(c, 'type');
      if (type === 'page') return true;
    }
  }
  return false;
}

function mapHeadingLevel(styleId: string): number | null {
  const id = styleId.toLowerCase();
  // WPS/Word 中文环境常见标题样式 ID
  if (id === 'heading1' || id === '标题1' || id === '1') return 1;
  if (id === 'heading2' || id === '标题2' || id === '2') return 2;
  if (id === 'heading3' || id === '标题3' || id === '3') return 3;
  if (id === 'heading4' || id === '标题4' || id === '4') return 4;
  if (id === 'heading5' || id === '标题5' || id === '5') return 5;
  if (id === 'heading6' || id === '标题6' || id === '6') return 6;
  return null;
}

function renderListMarker(numId: string, ilvl: string, ctx: RenderContext): string {
  const lvl = ctx.numberingResolver.resolve(numId, ilvl);
  if (!lvl) return '';
  let text = lvl.lvlText;
  // 简单替换 %1 为 1（实际应根据列表序号动态计算，导入阶段先固定为占位）
  text = text.replace(/%\d+/g, '1');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// 表格渲染
// ─────────────────────────────────────────────────────────────────────────────

function renderTable(tbl: Element, ctx: RenderContext): string {
  const tblPr = childByTag(tbl, 'tblPr');
  let tblStyle = parseTableProperties(tblPr);

  // 合并表格样式（Table Style）定义
  const tblStyleId = wAttr(childByTag(tblPr, 'tblStyle'), 'val');
  let resolvedTblCell: InlineStyle = {};
  if (tblStyleId) {
    const resolvedTbl = ctx.styleResolver.resolveTable(tblStyleId);
    tblStyle = { ...resolvedTbl.table, ...tblStyle };
    resolvedTblCell = resolvedTbl.cell;
  }

  const rows = childrenByTag(tbl, 'tr');
  const tblGrid = childByTag(tbl, 'tblGrid');
  let gridCols = tblGrid ? childrenByTag(tblGrid, 'gridCol').length : 0;
  if (gridCols === 0) {
    // 回退：按实际行的最大单元格数估算（处理没有 tblGrid 的表格）
    rows.forEach((tr) => {
      const cells = childrenByTag(tr, 'tc');
      let count = 0;
      cells.forEach((tc) => {
        const tcPr = childByTag(tc, 'tcPr');
        const gridSpan = parseInt(wAttr(childByTag(tcPr, 'gridSpan'), 'val') || '1', 10);
        count += gridSpan;
      });
      gridCols = Math.max(gridCols, count);
    });
  }

  // 预处理 vMerge 计算 rowspan
  const vMergeState = new Array(gridCols).fill(0);
  const rowspans: number[][] = rows.map(() => new Array(gridCols).fill(1));

  rows.forEach((tr, rIdx) => {
    let cIdx = 0;
    const cells = childrenByTag(tr, 'tc');
    cells.forEach((tc) => {
      // 跳过已被 rowspan 占用的列
      while (cIdx < gridCols && vMergeState[cIdx] > 0) {
        vMergeState[cIdx]--;
        cIdx++;
      }
      if (cIdx >= gridCols) return;

      const tcPr = childByTag(tc, 'tcPr');
      const vMergeEl = childByTag(tcPr, 'vMerge');
      const vMergeVal = vMergeEl ? (wAttr(vMergeEl, 'val') || 'continue') : null;
      const gridSpan = parseInt(wAttr(childByTag(tcPr, 'gridSpan'), 'val') || '1', 10);

      if (vMergeVal === 'restart') {
        // 开始 rowspan，向下统计
        let span = 1;
        for (let rr = rIdx + 1; rr < rows.length; rr++) {
          const nextCells = childrenByTag(rows[rr], 'tc');
          let ncIdx = 0;
          let found = false;
          for (const nc of nextCells) {
            while (ncIdx < gridCols && ncIdx < cIdx) {
              const nTcPr = childByTag(nc, 'tcPr');
              const nGridSpan = parseInt(wAttr(childByTag(nTcPr, 'gridSpan'), 'val') || '1', 10);
              ncIdx += nGridSpan;
              if (ncIdx > cIdx) break;
            }
            if (ncIdx === cIdx) {
              const nTcPr = childByTag(nc, 'tcPr');
              const nVMerge = childByTag(nTcPr, 'vMerge');
              const nVMergeVal = nVMerge ? (wAttr(nVMerge, 'val') || 'continue') : null;
              if (nVMergeVal) {
                span++;
                found = true;
              }
              break;
            }
          }
          if (!found) break;
        }
        rowspans[rIdx][cIdx] = span;
        for (let k = 0; k < gridSpan; k++) {
          if (cIdx + k < gridCols) vMergeState[cIdx + k] = span - 1;
        }
      } else if (vMergeVal === 'continue') {
        rowspans[rIdx][cIdx] = 0; // 被合并的单元格不输出
        for (let k = 0; k < gridSpan; k++) {
          if (cIdx + k < gridCols) vMergeState[cIdx + k]--;
        }
      } else {
        for (let k = 0; k < gridSpan; k++) {
          if (cIdx + k < gridCols) vMergeState[cIdx + k] = 0;
        }
      }

      cIdx += gridSpan;
    });

    // 清空剩余状态
    for (; cIdx < gridCols; cIdx++) {
      if (vMergeState[cIdx] > 0) vMergeState[cIdx]--;
    }
  });

  // 构建 HTML
  const tblStyleStr = inlineStyleToString(tblStyle);
  let html = `<table${tblStyleStr ? ` style="${tblStyleStr}"` : ''}>`;

  rows.forEach((tr, rIdx) => {
    html += '<tr>';
    let cIdx = 0;
    const cells = childrenByTag(tr, 'tc');
    cells.forEach((tc) => {
      if (cIdx >= gridCols) return;
      if (rowspans[rIdx][cIdx] === 0) {
        cIdx++;
        return;
      }

      const tcPr = childByTag(tc, 'tcPr');
      let cellStyle = parseTableCellProperties(tcPr);
      if (tblStyleId) {
        cellStyle = { ...resolvedTblCell, ...cellStyle };
      }
      const gridSpan = parseInt(wAttr(childByTag(tcPr, 'gridSpan'), 'val') || '1', 10);

      let attrs = '';
      if (gridSpan > 1) attrs += ` colspan="${gridSpan}"`;
      if (rowspans[rIdx][cIdx] > 1) attrs += ` rowspan="${rowspans[rIdx][cIdx]}"`;

      const styleStr = inlineStyleToString(cellStyle);
      if (styleStr) attrs += ` style="${styleStr}"`;

      let cellContent = '';
      const ps = childrenByTag(tc, 'p');
      ps.forEach((p) => {
        cellContent += renderParagraph(p, ctx);
      });

      html += `<td${attrs}>${cellContent}</td>`;
      cIdx += gridSpan;
    });
    html += '</tr>';
  });

  html += '</table>';

  // 封面信息表格兜底：如果表格本身没有边框，且内容匹配封面特征，注入虚线边框
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
      // 封面表格：添加 screen-only-border 类，打印时边框自动隐藏
      const widthStr = tblStyle.width ? `width:${tblStyle.width};` : 'width:520px;';
      html = html.replace(
        '<table',
        `<table class="cover-table screen-only-border" style="border-collapse:collapse;${widthStr}margin-left:auto;margin-right:auto;"`
      );
    }
  }

  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function parseRels(relsXml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  const doc = parseXml(relsXml);
  const relEls = childrenByTag(doc.documentElement, 'Relationship');
  relEls.forEach((el) => {
    const id = attr(el, 'Id');
    const target = attr(el, 'Target');
    if (id && target) map.set(id, target);
  });
  return map;
}

function attr(el: Element | null | undefined, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractTitle(bodyChildren: Element[]): string | null {
  for (const node of bodyChildren) {
    if (node.localName !== 'p') continue;
    const pPr = childByTag(node, 'pPr');
    const styleId = wAttr(childByTag(pPr, 'pStyle'), 'val') || '';
    if (mapHeadingLevel(styleId) === 1) {
      return collectText(node).trim() || null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 拆分
// ─────────────────────────────────────────────────────────────────────────────

function splitIntoSections(fullHtml: string): DocxSection[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${fullHtml}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLDivElement;
  const children = Array.from(container.children);
  const sections: DocxSection[] = [];

  let currentType: DocxSection['type'] = 'cover';
  let currentParts: string[] = [];
  let currentTitle = '';
  let currentLevel = 1;
  let hasMetToc = false;
  let hasMetUsage = false;
  let skippingToc = false;

  function flush() {
    if (currentParts.length) {
      sections.push({
        type: currentType,
        title: currentTitle,
        level: currentLevel,
        html: currentParts.join(''),
      });
      currentParts = [];
    }
  }

  for (const child of children) {
    const text = child.textContent?.trim() || '';
    const tag = child.tagName.toLowerCase();

    // 分页符保留在当前 section
    if (child.classList.contains('page-break')) {
      if (!skippingToc) currentParts.push(child.outerHTML);
      continue;
    }

    // 使用说明（只识别一次）
    if (/^使用说明$/.test(text) && !hasMetUsage) {
      flush();
      currentType = 'usage';
      currentTitle = '使用说明';
      currentLevel = 1;
      hasMetUsage = true;
      skippingToc = false;
      currentParts.push(child.outerHTML);
      continue;
    }

    // 目录（只识别一次）— 跳过不导入
    if (/^目\s*录$/.test(text) && !hasMetToc) {
      flush();
      hasMetToc = true;
      skippingToc = true;
      continue;
    }

    // heading 触发正文分段
    const headingMatch = tag.match(/^h([1-6])$/);
    if (headingMatch) {
      if (skippingToc) {
        skippingToc = false;
        currentType = 'body';
      } else if (currentType !== 'body') {
        flush();
        currentType = 'body';
      } else {
        flush();
      }
      currentTitle = text;
      currentLevel = parseInt(headingMatch[1], 10);
      currentParts.push(child.outerHTML);
      continue;
    }

    if (!skippingToc) {
      currentParts.push(child.outerHTML);
    }
  }

  flush();
  return sections;
}
