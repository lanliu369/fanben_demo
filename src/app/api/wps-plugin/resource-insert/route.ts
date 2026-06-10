/**
 * 金山 WPS WebOffice 场景下的「资源插入」桥接 manifest（侧栏轮询 insert-queue 为主路径）。
 */
import { NextRequest, NextResponse } from 'next/server';

const RESOURCE_INSERT_PLUGIN_GUID = 'wps-resource-insert-bridge-v1';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

function getBrowserOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  return `${proto}://${host}`.replace(/\/$/, '');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const docId = request.nextUrl.searchParams.get('docId') ?? '';
  const origin = getBrowserOrigin(request);

  const url = `${origin}/wps-plugins/resource-insert/index.html?docId=${encodeURIComponent(docId)}&apiBase=${encodeURIComponent(origin)}`;

  return NextResponse.json(
    {
      name: 'Resource Insert Bridge',
      guid: RESOURCE_INSERT_PLUGIN_GUID,
      baseUrl: `${origin}/wps-plugins/resource-insert/`,
      variations: [
        {
          description: 'Queued resource insertion (compatible iframe bridge)',
          url,
          icons: [`${origin}/wps-plugins/resource-insert/icon.svg`, `${origin}/wps-plugins/resource-insert/icon.svg`],
          isViewer: false,
          EditorsSupport: ['word'],
          isVisual: false,
        },
      ],
    },
    { headers: CORS_HEADERS },
  );
}
