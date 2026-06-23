import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { docxPathForId } from '@/lib/documentsDir';

async function exportHtmlViaMammoth(id: string): Promise<string | null> {
  const fp = docxPathForId(id);
  try {
    const buf = await fs.readFile(fp);
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

/** 服务端 docx→HTML（金山 WPS 或其它方式保存后的磁盘稿）；无本地文件时返回错误 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const localHtml = await exportHtmlViaMammoth(id);
  if (localHtml) {
    return new NextResponse(localHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    { error: 'no_local_docx', detail: `Expected ${path.join('public', 'documents', `${id}.docx`)}` },
    { status: 404 },
  );
}
