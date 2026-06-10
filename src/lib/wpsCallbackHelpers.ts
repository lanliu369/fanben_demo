import { NextRequest, NextResponse } from 'next/server';
import { assertWpsCallbackAllowed } from '@/lib/wpsCallbackAuth';

export function wpsCallbackUri(req: NextRequest): string {
  return req.nextUrl.pathname + req.nextUrl.search;
}

export async function readRawBody(req: NextRequest): Promise<Buffer> {
  return Buffer.from(await req.arrayBuffer());
}

export function wpsOk<T>(data: T) {
  return NextResponse.json({ code: 0, data }, { status: 200 });
}

export function wpsFail(code: number, message: string) {
  return NextResponse.json({ code, message }, { status: 200 });
}

export function guardWpsSignature(req: NextRequest, rawBody: Buffer, uri: string): NextResponse | null {
  if (!assertWpsCallbackAllowed(req, rawBody, uri)) {
    return wpsFail(40003, 'invalid signature');
  }
  return null;
}
