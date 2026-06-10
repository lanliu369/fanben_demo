import { notFound } from 'next/navigation';
import { SystemErrorPage } from '@/components/ui/SystemErrorPage';

export const dynamic = 'force-dynamic';

/** 仅开发环境：便于核对错误页样式是否为新 UI（线框图标 + 小圆底）。生产运行时访问将 404。 */
export default function DevErrorPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <SystemErrorPage variant="404" />;
}
