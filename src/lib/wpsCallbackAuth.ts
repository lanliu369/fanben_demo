import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * WPS WebOffice 回调签名（WPS-2），见 https://solution.wps.cn/docs/callback/summary.html
 * Authorization: WPS-2:AppId:SHA1(AppSecret + Content-Md5 + Content-Type + Date)
 */
export function computeContentMd5(method: string, rawBody: Buffer, uriForSignature: string): string {
  if (rawBody.length > 0) {
    return crypto.createHash('md5').update(rawBody).digest('hex').toLowerCase();
  }
  return crypto.createHash('md5').update(uriForSignature).digest('hex').toLowerCase();
}

export function computeWps2Token(appSecret: string, contentMd5: string, contentType: string, date: string): string {
  return crypto
    .createHash('sha1')
    .update(appSecret + contentMd5 + contentType + date)
    .digest('hex')
    .toLowerCase();
}

export function verifyWps2Authorization(
  authorization: string | null,
  appId: string,
  appSecret: string,
  contentMd5: string,
  contentType: string,
  date: string,
): boolean {
  if (!authorization?.startsWith('WPS-2:')) return false;
  const parts = authorization.split(':');
  if (parts.length !== 3) return false;
  const [, id, sig] = parts;
  if (id !== appId) return false;
  const expected = computeWps2Token(appSecret, contentMd5, contentType, date);
  return sig.toLowerCase() === expected;
}

/** Content-Type：GET 等无 Body 时使用空字符串参与签名 */
export function contentTypeForSignature(req: NextRequest, rawBodyLength: number): string {
  if (rawBodyLength > 0) {
    return req.headers.get('content-type')?.split(';')[0]?.trim() || 'application/json';
  }
  return '';
}

export function assertWpsCallbackAllowed(req: NextRequest, rawBody: Buffer, uriForSignature: string): boolean {
  const appId = process.env.WPS_WEBOFFICE_APP_ID?.trim();
  const secret = process.env.WPS_WEBOFFICE_APP_SECRET?.trim();
  if (!secret || !appId) {
    console.warn('[WPS callback] WPS_WEBOFFICE_APP_SECRET / APP_ID 未配置，跳过签名校验（仅可用于本地调试）');
    return true;
  }
  const auth = req.headers.get('authorization');
  const date = req.headers.get('date') || req.headers.get('Date');
  const ct = contentTypeForSignature(req, rawBody.length);
  const md5 = computeContentMd5(req.method, rawBody, uriForSignature);

  console.log('[WPS callback] 签名校验调试:');
  console.log('  method:', req.method);
  console.log('  uri:', uriForSignature);
  console.log('  content-md5:', md5);
  console.log('  content-type:', ct);
  console.log('  date:', date);
  console.log('  authorization:', auth);

  if (!auth || !date) {
    console.log('[WPS callback] 缺少 auth 或 date header，校验失败');
    return false;
  }
  const ok = verifyWps2Authorization(auth, appId, secret, md5, ct, date);
  if (!ok) {
    const expected = computeWps2Token(secret, md5, ct, date);
    console.log('[WPS callback] 签名不匹配。期望:', `WPS-2:${appId}:${expected}`);
  }
  return ok;
}
