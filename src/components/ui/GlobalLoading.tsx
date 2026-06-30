'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type GlobalLoadingState = {
  visible: boolean;
  message: string;
};

type GlobalLoadingContextValue = {
  show: (message?: string) => void;
  hide: () => void;
  wrap: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GlobalLoadingState>({ visible: false, message: '正在加载中…' });
  const pendingCountRef = useRef(0);

  const show = useCallback((message?: string) => {
    pendingCountRef.current += 1;
    setState({ visible: true, message: message?.trim() ? message : '正在加载中…' });
  }, []);

  const hide = useCallback(() => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    if (pendingCountRef.current === 0) {
      setState((prev) => ({ ...prev, visible: false }));
    }
  }, []);

  const wrap = useCallback(async <T,>(fn: () => Promise<T>, message?: string) => {
    show(message);
    try {
      return await fn();
    } finally {
      hide();
    }
  }, [hide, show]);

  const value = useMemo<GlobalLoadingContextValue>(() => ({ show, hide, wrap }), [hide, show, wrap]);

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      {state.visible && (
        <div className="fixed inset-0 z-[200] bg-black/35 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <div className="text-sm text-slate-700">{state.message}</div>
          </div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }
  return ctx;
}

