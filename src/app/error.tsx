'use client';

import { useEffect } from 'react';
import { SystemErrorPage } from '@/components/ui/SystemErrorPage';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <SystemErrorPage variant="500" onRefresh={reset} />;
}
