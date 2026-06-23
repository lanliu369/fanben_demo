import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsFail,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { buildWpsFileInfo, requireDocxAndMeta } from '@/lib/wpsDocumentMeta';

export async function GET(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  const { file_id } = await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  try {
    const rec = await requireDocxAndMeta(file_id, file_id);
    return wpsOk(await buildWpsFileInfo(file_id, rec));
  } catch (e) {
    console.error('[WPS callback] file info:', e);
    return wpsFail(40004, 'file not accessible');
  }
}
