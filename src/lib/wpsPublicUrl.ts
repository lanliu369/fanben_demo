import type { NextRequest } from 'next/server';

/** 控制台回调根地址应对外的公网 Origin；未配置时从请求头推导（仅供开发） */
export function publicBaseUrlFromRequest(req: NextRequest): string {
  const env = process.env.WPS_CALLBACK_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    req.nextUrl.protocol.replace(':', '');
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    req.nextUrl.host;
  return `${proto}://${host}`.replace(/\/$/, '');
}
