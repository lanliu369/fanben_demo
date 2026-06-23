/** 探测 WPS 回调公网根地址是否可达（Quick Tunnel 重启后 URL 会变，失效时 WPS 编辑器会空白） */
export async function probeCallbackPublicBase(base: string): Promise<boolean> {
  const root = base.trim().replace(/\/$/, '');
  if (!root.startsWith('http://') && !root.startsWith('https://')) {
    return false;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(root, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      cache: 'no-store',
    });
    return res.status < 502;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function callbackPublicBaseFromEnv(): string {
  return process.env.WPS_CALLBACK_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, '') ?? '';
}
