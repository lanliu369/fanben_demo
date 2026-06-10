import { NextRequest } from 'next/server';
import {
  guardWpsSignature,
  readRawBody,
  wpsCallbackUri,
  wpsOk,
} from '@/lib/wpsCallbackHelpers';
import { getWpsDefaultUserId, getWpsDefaultUserName, sanitizeWpsUserId } from '@/lib/wpsDocumentMeta';

type WpsUserRow = { id: string; name: string };

function buildUserRows(rawIds: string[]): WpsUserRow[] {
  const defaultId = getWpsDefaultUserId();
  const defaultName = getWpsDefaultUserName();
  return rawIds.map((id) => {
    const sid = sanitizeWpsUserId(id);
    if (sid === defaultId) {
      return { id: sid, name: defaultName };
    }
    return { id: sid, name: sid };
  });
}

function parseUserIdsFromJson(body: Buffer): string[] {
  if (body.length === 0) return [];
  try {
    const j = JSON.parse(body.toString('utf-8')) as Record<string, unknown>;
    if (Array.isArray(j.user_ids)) {
      return j.user_ids.map((x) => String(x));
    }
    if (Array.isArray(j.ids)) {
      return j.ids.map((x) => String(x));
    }
    if (typeof j.user_ids === 'string') {
      return [j.user_ids];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function GET(req: NextRequest) {
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  const ids = req.nextUrl.searchParams.getAll('user_ids');
  return wpsOk(buildUserRows(ids));
}

/** 部分环境下金山会用 POST + JSON 批量查询 users（与 GET 等价语义） */
export async function POST(req: NextRequest) {
  const uri = wpsCallbackUri(req);
  const rawBody = await readRawBody(req);
  const denied = guardWpsSignature(req, rawBody, uri);
  if (denied) return denied;

  const ids = parseUserIdsFromJson(rawBody);
  return wpsOk(buildUserRows(ids));
}
