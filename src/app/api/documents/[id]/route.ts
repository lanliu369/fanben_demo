import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { bumpVersionAfterSave } from '@/lib/wpsDocumentMeta';
import {
  DOCS_DIR,
  ensureDocumentsDir,
  docxPathForId,
  isImportTemplateId,
  PLACEHOLDER_DOCX_MAX_BYTES,
} from '@/lib/documentsDir';

/** 超过此大小的 docx 不再做 strip/sanitize，避免 JSZip 重打包后体积异常且 WPS 打开空白 */
const DOCX_SANITIZE_MAX_BYTES = 256 * 1024;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function createDefaultDocxBuffer(title: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXml(title || '新建文档')}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  return zip.generateAsync({ type: 'nodebuffer' });
}

function stripSdtAndProtection(xml: string): string {
  let current = xml;

  // Remove edit protection markers that can trigger restricted-mode prompts.
  current = current
    .replace(/<w:permStart\b[^>]*\/>/g, '')
    .replace(/<w:permEnd\b[^>]*\/>/g, '');

  // Unwrap customXml wrapper while preserving its inner content.
  current = current.replace(/<w:customXml\b[^>]*>([\s\S]*?)<\/w:customXml>/g, '$1');

  // Unwrap content controls (w:sdt) to keep visible text and structure.
  const sdtPattern = /<w:sdt\b[\s\S]*?<w:sdtContent\b[^>]*>([\s\S]*?)<\/w:sdtContent>[\s\S]*?<\/w:sdt>/g;
  while (sdtPattern.test(current)) {
    current = current.replace(sdtPattern, '$1');
  }

  return current;
}

function normalizeFontNames(xml: string): string {
  const mapping: Record<string, string> = {
    SimSun: 'Songti SC',
    NSimSun: 'Songti SC',
    宋体: 'Songti SC',
    SimHei: 'Heiti TC',
    黑体: 'Heiti TC',
  };

  // Normalize font-family values in WordprocessingML and DrawingML attributes.
  return xml.replace(
    /(w:(?:ascii|hAnsi|eastAsia|cs)|a:typeface)="([^"]+)"/g,
    (full, attr: string, family: string) => {
      const normalized = mapping[family];
      if (!normalized) {
        return full;
      }
      return `${attr}="${normalized}"`;
    }
  );
}

async function sanitizeDocxBuffer(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const targets = zip.file(/^word\/(document|styles|settings|fontTable|theme\/theme\d+|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/);

  for (const entry of targets) {
    const xml = await entry.async('string');
    const sanitized = normalizeFontNames(stripSdtAndProtection(xml));
    zip.file(entry.name, sanitized);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

// 确保文档目录存在
ensureDocumentsDir();

// HEAD /api/documents/[id] - 探测本地 docx 是否存在（不创建占位文件）
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filePath = path.join(DOCS_DIR, `${id}.docx`);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
}

// GET /api/documents/[id] - 下载文档
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = docxPathForId(id);

  if (!fs.existsSync(filePath)) {
    if (isImportTemplateId(id)) {
      return new NextResponse(null, { status: 404 });
    }
    // 文件不存在时，返回空白模板
    const templatePath = path.join(DOCS_DIR, 'template.docx');
    if (fs.existsSync(templatePath)) {
      const fileBuffer = fs.readFileSync(templatePath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${id}.docx"`,
        },
      });
    }
    const defaultBuffer = await createDefaultDocxBuffer(id);
    fs.writeFileSync(filePath, defaultBuffer);
    return new NextResponse(new Uint8Array(defaultBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${id}.docx"`,
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${id}.docx"`,
    },
  });
}

// POST /api/documents/[id] - 上传/创建文档
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { content } = body as { content?: string };

  const filePath = docxPathForId(id);
  ensureDocumentsDir();

  // 如果传入 base64 内容，写入文件
  if (content) {
    const buffer = Buffer.from(content, 'base64');
    if (isImportTemplateId(id) && buffer.length < PLACEHOLDER_DOCX_MAX_BYTES) {
      return NextResponse.json(
        { error: 'import_docx_too_small', detail: '导入 docx 体积异常，请重新导入完整文件' },
        { status: 400 },
      );
    }
    const sanitized =
      buffer.length <= DOCX_SANITIZE_MAX_BYTES
        ? await sanitizeDocxBuffer(buffer).catch(() => buffer)
        : buffer;
    fs.writeFileSync(filePath, sanitized);
    try {
      const metaPath = path.join(DOCS_DIR, `${id}.wps.json`);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
    } catch {
      /* 重置 WPS 版本元数据，避免沿用过期空白会话 */
    }
    try {
      await bumpVersionAfterSave(id, `${id}.docx`);
    } catch (verErr) {
      console.warn('[documents POST] bump version failed:', verErr);
    }
  } else {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  return NextResponse.json({ success: true, id });
}
