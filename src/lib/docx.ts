import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

/**
 * 创建包含指定标题的 DOCX 文件
 */
export async function createDocxWithHeading(filePath: string, title: string): Promise<void> {
  const templatePath = path.join(process.cwd(), 'public/documents/template.docx');
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // 构建包含 Heading1 的 document.xml
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

/**
 * 更新 DOCX 文件的第一个 Heading1 标题
 */
export async function updateDocxHeading(filePath: string, newTitle: string): Promise<void> {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Invalid DOCX: word/document.xml not found');
  }

  // 查找第一个 Heading1 段落并替换标题文本
  const heading1Regex = /(<w:p>[\s\S]*?<w:pStyle w:val="Heading1"[\s\S]*?<w:t>)([\s\S]*?)(<\/w:t>[\s\S]*?<\/w:p>)/;
  const match = documentXml.match(heading1Regex);

  let updatedXml: string;
  if (match) {
    // 替换现有 Heading1
    updatedXml = documentXml.replace(heading1Regex, `$1${escapeXml(newTitle)}$3`);
  } else {
    // 如果没有 Heading1，在 body 开头插入
    updatedXml = documentXml.replace(
      /(<w:body>)/,
      `$1\n    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:t>${escapeXml(newTitle)}</w:t>
      </w:r>
    </w:p>`
    );
  }

  zip.file('word/document.xml', updatedXml);

  const newBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, newBuffer);
}

/**
 * 从 DOCX 文件中提取第一个 Heading1 标题
 */
export async function extractDocxHeading(filePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      return null;
    }

    // 匹配第一个 Heading1 段落的文本内容
    const heading1Regex = /<w:p>[\s\S]*?<w:pStyle w:val="Heading1"[\s\S]*?<w:t>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:p>/;
    const match = documentXml.match(heading1Regex);

    if (match && match[1]) {
      return unescapeXml(match[1]);
    }

    return null;
  } catch (error) {
    console.error('Error extracting heading:', error);
    return null;
  }
}

/**
 * XML 转义
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * XML 反转义
 */
function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
