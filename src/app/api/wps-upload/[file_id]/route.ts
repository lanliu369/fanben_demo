import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { validateUploadTicket } from '@/lib/wpsUploadTicket';
import { ensureDocumentsDir, docxPathForId } from '@/lib/documentsDir';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ file_id: string }> },
) {
  const { file_id } = await params;
  const secret = req.nextUrl.searchParams.get('s');
  if (!validateUploadTicket(secret, file_id)) {
    return NextResponse.json({ error: 'invalid upload ticket' }, { status: 403 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) {
    return NextResponse.json({ error: 'empty body' }, { status: 400 });
  }

  const dest = docxPathForId(file_id);
  ensureDocumentsDir();
  await fs.writeFile(dest, buf);

  return new NextResponse(null, { status: 200 });
}
