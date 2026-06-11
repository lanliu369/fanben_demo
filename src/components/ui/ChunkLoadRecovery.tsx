'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'fanben-chunk-reload';

function isChunkLoadFailure(message: string) {
  return (
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Failed to load chunk')
  );
}

/**
 * 部署后旧 HTML 引用已失效的 JS chunk 时会抛 ChunkLoadError；自动刷新一次拉取最新资源。
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const tryReload = (message: string) => {
      if (!isChunkLoadFailure(message)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string } | string | undefined;
      const message = typeof reason === 'string' ? reason : reason?.message ?? '';
      tryReload(message);
    };

    const onError = (event: ErrorEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName !== 'SCRIPT') return;
      tryReload(event.message || 'Failed to load chunk');
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  return null;
}
