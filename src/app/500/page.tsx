'use client';

import { SystemErrorPage } from '@/components/ui/SystemErrorPage';

/**
 * 静态展示 500 界面（与运行时错误边界同款样式）。
 * 不再在服务端 throw，避免误入 `/500` 时产生真实异常记录。
 * 运行时未捕获错误仍由根级 `app/error.tsx` 渲染同一套 UI。
 */
export default function InternalServerErrorStaticPage() {
  return <SystemErrorPage variant="500" />;
}
