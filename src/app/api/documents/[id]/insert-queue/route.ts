import { NextRequest, NextResponse } from 'next/server';

type InsertQueueItem = {
  text: string;
  html?: string;
  label?: string;
  createdAt: number;
};

const docInsertQueues = new Map<string, InsertQueueItem[]>();
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

function getQueue(docId: string) {
  const q = docInsertQueues.get(docId);
  if (q) return q;
  const next: InsertQueueItem[] = [];
  docInsertQueues.set(docId, next);
  return next;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shouldTake = request.nextUrl.searchParams.get('take') === '1';
  const queue = getQueue(id);

  if (!shouldTake) {
    return NextResponse.json({ size: queue.length }, { headers: CORS_HEADERS });
  }

  const item = queue.shift() ?? null;
  return NextResponse.json({ item, size: queue.length }, { headers: CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as { text?: string; html?: string; label?: string };
    const text = (body.text ?? '').trim();
    const htmlRaw = typeof body.html === 'string' ? body.html.trim() : '';
    const html = htmlRaw || undefined;
    const label = typeof body.label === 'string' ? body.label : undefined;
    if (!text && !html) {
      return NextResponse.json({ error: 'text or html is required' }, { status: 400, headers: CORS_HEADERS });
    }
    const queue = getQueue(id);
    queue.push({ text: text || '\u200b', html, label, createdAt: Date.now() });
    // 避免开发期长时间积压，保留最近 30 条
    if (queue.length > 30) {
      queue.splice(0, queue.length - 30);
    }
    return NextResponse.json({ ok: true, size: queue.length }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400, headers: CORS_HEADERS });
  }
}
