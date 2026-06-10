import { forbidden } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * 访问 `/403` 时由 Next 中断并渲染 `app/forbidden.tsx`，响应状态码为 **403**。
 * UI 与规格一致（SystemErrorPage · 403）。
 */
export default function ForbiddenTriggerPage() {
  forbidden();
}
