import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { getWpsDefaultUserId } from '@/lib/wpsDocumentMeta';

export async function GET(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  const uid = getWpsDefaultUserId();
  return wpsOk({
    user_id: uid,
    read: 1,
    update: 1,
    download: 1,
    rename: 1,
    history: 1,
    copy: 1,
    print: 1,
    saveas: 1,
    comment: 1,
  });
}
