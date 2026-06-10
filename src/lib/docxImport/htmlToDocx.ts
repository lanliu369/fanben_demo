import { asBlob } from 'html-docx-js-typescript';
import type { DocxSection } from './docxToHtml';

export interface HtmlToDocxOptions {
  title?: string;
  /** 页面宽度 px，默认 794（A4 宽） */
  pageWidth?: number;
  /** 页面高度 px，默认 1123（A4 高） */
  pageHeight?: number;
  /** 页边距 px，默认 96（约 2.54cm） */
  pageMargin?: number;
}

/**
 * 将高保真 HTML 导出为 DOCX Blob
 *
 * 说明：html-docx-js-typescript 对复杂表格样式的支持有限，
 * 但对于以段落、简单表格为主的招标文件已足够使用。
 * 如需 100% 精确还原（如虚线表格边框、单元格合并、页眉页脚），
 * 建议后续引入后端 docx 库（npm: docx）进行精确映射。
 */
export async function htmlToDocx(
  html: string,
  options: HtmlToDocxOptions = {}
): Promise<Blob> {
  const { title = '文档', pageWidth = 794, pageHeight = 1123, pageMargin = 96 } = options;

  // 构建完整的 Word HTML 包装
  const fullHtml = wrapWordHtml(html, { title, pageWidth, pageHeight, pageMargin });

  try {
    const blob = (await asBlob(fullHtml)) as Blob;
    return blob;
  } catch (err) {
    throw new Error('DOCX 导出失败: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * 将 DocxSection[] 拼接后导出为 DOCX
 */
export async function sectionsToDocx(
  sections: DocxSection[],
  options: HtmlToDocxOptions = {}
): Promise<Blob> {
  const html = sections.map((s) => s.html).join('');
  return htmlToDocx(html, options);
}

function wrapWordHtml(
  bodyHtml: string,
  options: Required<HtmlToDocxOptions> & { title: string }
): string {
  const { title, pageWidth, pageHeight, pageMargin } = options;

  // 注意：html-docx-js 依赖内联样式，因此我们把所有标书规范样式写入 <style>
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* 页面基础 */
    @page {
      size: ${pageWidth}px ${pageHeight}px;
      margin: ${pageMargin}px;
    }
    body {
      font-family: "SimSun", "宋体", serif;
      font-size: 16px;
      line-height: 29.3px;
      margin: 0;
      padding: 0;
    }

    /* 标题 */
    h1 {
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 29.3px;
      font-weight: 700;
      text-align: center;
      line-height: 29.3px;
      margin: 22px 0;
    }
    h2 {
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 20px;
      font-weight: 700;
      text-align: left;
      line-height: 29.3px;
      margin: 11px 0;
    }
    h3 {
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 18.7px;
      font-weight: 700;
      text-align: left;
      line-height: 29.3px;
      margin: 6.6px 0;
    }
    h4, h5, h6 {
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 16px;
      font-weight: 700;
      text-align: left;
      line-height: 29.3px;
      margin: 6.6px 0;
    }

    /* 正文 */
    p {
      font-family: "SimSun", "宋体", serif;
      font-size: 16px;
      text-align: justify;
      line-height: 29.3px;
      text-indent: 2em;
      margin: 0;
    }
    strong, b {
      font-family: "SimSun", "宋体", serif;
      font-size: 16px;
      font-weight: 700;
    }

    /* 分页符 */
    .page-break {
      page-break-after: always;
      height: 0;
      margin: 0;
    }

    /* 表格 */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5rem 0;
    }
    td, th {
      padding: 4px 6px;
      text-align: center;
      vertical-align: middle;
      font-size: 14px;
      line-height: 24px;
    }
    th {
      font-family: "SimHei", "黑体", sans-serif;
      font-weight: 700;
      background: #fff;
    }

    /* 图片 */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0.5rem auto;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
