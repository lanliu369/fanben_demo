import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createDocxWithHeading, updateDocxHeading, extractDocxHeading } from '@/lib/docx';
import { docxPathForId } from '@/lib/documentsDir';

/**
 * GET /api/documents/[id]/heading
 * 获取文档的 Heading1 标题
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const docPath = docxPathForId(id);

    // 检查文件是否存在
    try {
      await fs.access(docPath);
    } catch {
      return NextResponse.json({ title: null }, { status: 200 });
    }

    const title = await extractDocxHeading(docPath);
    return NextResponse.json({ title }, { status: 200 });
  } catch (error) {
    console.error('Error reading heading:', error);
    return NextResponse.json(
      { error: 'Failed to read heading' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/documents/[id]/heading
 * 更新或创建文档的 Heading1 标题
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title } = await request.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const docPath = docxPathForId(id);

    // 检查文件是否存在
    let fileExists = false;
    try {
      await fs.access(docPath);
      fileExists = true;
    } catch {
      // 文件不存在
    }

    if (fileExists) {
      // 更新现有文件
      await updateDocxHeading(docPath, title);
    } else {
      // 创建新文件
      await createDocxWithHeading(docPath, title);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error updating heading:', error);
    return NextResponse.json(
      { error: 'Failed to update heading' },
      { status: 500 }
    );
  }
}
