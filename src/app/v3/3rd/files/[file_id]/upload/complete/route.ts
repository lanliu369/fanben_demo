import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsFail,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { extractDocxHeading } from '@/lib/docx';
import { buildWpsFileInfo, bumpVersionAfterSave } from '@/lib/wpsDocumentMeta';
import { revokeUploadTicket } from '@/lib/wpsUploadTicket';

const DOCS_DIR = path.join(process.cwd(), 'public', 'documents');

export async function POST(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  const { file_id } = await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  let body: {
    request?: { name?: string };
    response?: { status_code?: number };
    send_back_params?: { upload_ticket?: string };
  };
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as typeof body;
  } catch {
    return wpsFail(40002, 'invalid json body');
  }

  const ticket = body.send_back_params?.upload_ticket;

  const statusCode = body.response?.status_code ?? -1;
  if (statusCode !== 200) {
    if (ticket) revokeUploadTicket(ticket);
    return wpsFail(40005, `upload failed: HTTP ${statusCode}`);
  }

  const name = typeof body.request?.name === 'string' ? body.request.name : '';
  if (!name.trim()) {
    if (ticket) revokeUploadTicket(ticket);
    return wpsFail(40002, 'request.name required');
  }

  try {
    const rec = await bumpVersionAfterSave(file_id, name);
    const docxPath = path.join(DOCS_DIR, `${file_id}.docx`);
    try {
      const title = await extractDocxHeading(docxPath);
      if (title) {
        const sidecarPath = path.join(DOCS_DIR, `${file_id}.meta.json`);
        await fs.writeFile(sidecarPath, JSON.stringify({ title, updatedAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('[WPS upload/complete] heading extract:', err);
    }

    if (ticket) revokeUploadTicket(ticket);
    return wpsOk(await buildWpsFileInfo(file_id, rec));
  } catch (e) {
    console.error('[WPS upload/complete]:', e);
    if (ticket) revokeUploadTicket(ticket);
    return wpsFail(40005, 'save failed');
  }
}
