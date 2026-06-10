'use client';

import { createContext, useContext } from 'react';

type AppShellContextValue = {
  setImmersive: (value: boolean) => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error('useAppShell must be used within MainLayout');
  }
  return ctx;
}
