/** 金山 WPS WebOffice JSSDK（全局 WebOfficeSDK），参见 https://solution.wps.cn/docs/web/quick-start.html */

export type WebOfficeOfficeType = 'w' | 's' | 'p' | 'f' | 'o' | 'd';

export type WebOfficeInitPayload = {
  sdkUrl: string;
  appId: string;
  fileId: string;
  token?: string;
  endpoint?: string;
  officeType: WebOfficeOfficeType;
};

export type WebOfficeSdkInstance = {
  destroy?: () => void;
  ready?: () => Promise<void>;
  save?: () => Promise<{ result?: string; size?: number; version?: number }> | { result?: string };
  on?: (event: string, cb: (data?: unknown) => void) => void;
  Application?: unknown;
};

declare global {
  interface Window {
    WebOfficeSDK?: {
      OfficeType: Record<string, string>;
      init: (opts: Record<string, unknown>) => WebOfficeSdkInstance;
    };
  }
}

export function loadWebOfficeSdk(url: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.WebOfficeSDK?.init) return Promise.resolve();
  const existing = document.querySelector(`script[data-weboffice-sdk="1"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('WebOffice SDK 脚本加载失败')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.dataset.webofficeSdk = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('WebOffice SDK 不可达，请检查 NEXT_PUBLIC_WPS_WEBOFFICE_SDK_URL'));
    document.head.appendChild(s);
  });
}
