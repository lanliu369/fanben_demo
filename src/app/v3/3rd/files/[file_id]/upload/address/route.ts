import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsFail,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { issueUploadTicket } from '@/lib/wpsUploadTicket';
import { publicBaseUrlFromRequest } from '@/lib/wpsPublicUrl';

export async function POST(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  const { file_id } = await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
  } catch {
    return wpsFail(40002, 'invalid json body');
  }

  const name = typeof body.name === 'string' ? body.name : '';
  if (!name.trim()) {
    return wpsFail(40002, 'name required');
  }

  const secret = issueUploadTicket(file_id);
  const base = publicBaseUrlFromRequest(req);
  const uploadUrl = `${base}/api/wps-upload/${encodeURIComponent(file_id)}?s=${encodeURIComponent(secret)}`;

  return wpsOk({
    url: uploadUrl,
    method: 'PUT',
    send_back_params: { upload_ticket: secret },
  });
}
