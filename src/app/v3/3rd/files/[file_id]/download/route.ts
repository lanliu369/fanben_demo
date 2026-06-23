import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsFail,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { requireDocxAndMeta } from '@/lib/wpsDocumentMeta';
import { publicBaseUrlFromRequest } from '@/lib/wpsPublicUrl';

export async function GET(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  const { file_id } = await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  try {
    await requireDocxAndMeta(file_id, file_id);
    const envBase = process.env.WPS_CALLBACK_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, '');
    const base = envBase || publicBaseUrlFromRequest(req);
    const url = `${base}/api/documents/${encodeURIComponent(file_id)}`;
    return wpsOk({ url });
  } catch (e) {
    console.error('[WPS callback] download:', e);
    return wpsFail(40004, 'file not accessible');
  }
}
