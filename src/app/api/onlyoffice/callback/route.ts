import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'public', 'documents');

/**
 * OnlyOffice Document Server callback
 * https://api.onlyoffice.com/editors/callback
 *
 * status:
 *  0 - no changes
 *  1 - being edited
 *  2 - ready for saving
 *  3 - saving error
 *  4 - document closed without changes
 *  6 - document being edited and saved
 *  7 - force saving error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, url, key } = body;

    console.log('[OnlyOffice callback]', { status, key, hasUrl: !!url });

    // status 2 = ready for saving, status 6 = force saving
    if ((status === 2 || status === 6) && url) {
      const fileId = key; // key is used as fileId
      const filePath = path.join(DOCS_DIR, `${fileId}.docx`);
      fs.mkdirSync(DOCS_DIR, { recursive: true });

      // Download edited document from OnlyOffice
      const fileResp = await fetch(url);
      if (!fileResp.ok) {
        console.error('[OnlyOffice callback] Failed to download:', fileResp.status);
        return NextResponse.json({ error: 1, message: 'download failed' });
      }
      const buffer = Buffer.from(await fileResp.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      console.log('[OnlyOffice callback] Saved to', filePath, 'size:', buffer.length);
    }

    return NextResponse.json({ error: 0 });
  } catch (err) {
    console.error('[OnlyOffice callback] Error:', err);
    return NextResponse.json({ error: 1, message: String(err) });
  }
}
