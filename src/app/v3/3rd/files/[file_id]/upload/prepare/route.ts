import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ file_id: string }> }) {
  await params;
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  return wpsOk({ digest_types: ['sha1', 'md5', 'sha256'] });
}
