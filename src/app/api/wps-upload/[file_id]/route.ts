import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateUploadTicket } from '@/lib/wpsUploadTicket';

const DOCS_DIR = path.join(process.cwd(), 'public', 'documents');

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

  const dest = path.join(DOCS_DIR, `${file_id}.docx`);
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(dest, buf);

  return new NextResponse(null, { status: 200 });
}
