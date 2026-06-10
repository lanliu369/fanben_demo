'use client';

import { useRouter } from 'next/navigation';
import { HelpCircle, Lock, ServerCrash } from 'lucide-react';

export type SystemErrorVariant = '403' | '404' | '500';

const COPY: Record<
  SystemErrorVariant,
  { code: string; message: string }
> = {
  '403': { code: '403', message: '抱歉，你无权访问该页面' },
  '404': { code: '404', message: '抱歉，您访问的页面不存在' },
  '500': { code: '500', message: '抱歉，服务器出错了' },
};

function ErrorIllustration({ variant }: { variant: SystemErrorVariant }) {
  const size = 48;
  const stroke = 1.25;
  const color = 'text-slate-400';
  if (variant === '403') {
    return <Lock className={color} size={size} strokeWidth={stroke} aria-hidden />;
  }
  if (variant === '404') {
    return <HelpCircle className={color} size={size} strokeWidth={stroke} aria-hidden />;
  }
  return <ServerCrash className={color} size={size} strokeWidth={stroke} aria-hidden />;
}

type SystemErrorPageProps = {
  variant: SystemErrorVariant;
  onRefresh?: () => void;
};

const btnBase =
  'inline-flex min-h-[40px] items-center justify-center rounded-lg px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

export function SystemErrorPage({ variant, onRefresh }: SystemErrorPageProps) {
  const router = useRouter();
  const { code, message } = COPY[variant];
  const isServerError = variant === '500';

  const handleRefreshList = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    router.refresh();
    window.location.reload();
  };

  const handleHome = () => {
    router.push('/');
  };

  const handleLogoutRelogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex min-h-[min(100dvh,100vh)] flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div
            data-system-error-art
            className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
            style={{
              width: 72,
              height: 72,
              flexShrink: 0,
            }}
          >
            <ErrorIllustration variant={variant} />
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-[2.75rem] sm:leading-none">
            {code}
          </h1>
          <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-slate-600 sm:text-[15px]">{message}</p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {isServerError ? (
              <>
                <button type="button" onClick={handleRefreshList} className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}>
                  刷新列表
                </button>
                <button
                  type="button"
                  onClick={handleHome}
                  className={`${btnBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50`}
                >
                  返回首页
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleHome} className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}>
                  返回首页
                </button>
                <button
                  type="button"
                  onClick={handleRefreshList}
                  className={`${btnBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50`}
                >
                  刷新列表
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-slate-50/90 px-4 py-4 sm:px-5">
          <p className="text-center text-sm font-medium text-slate-800">您可以：</p>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-center text-sm leading-relaxed text-slate-600">
            <li>
              <button
                type="button"
                onClick={handleLogoutRelogin}
                className="text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:text-blue-700"
              >
                退出重新登录
              </button>
              ；
            </li>
            <li>联系建设单位；</li>
          </ol>
          <p className="mt-3 border-t border-slate-200/80 pt-3 text-center text-xs leading-relaxed text-slate-500">
            说明：点击「退出重新登录」将退出系统并返回登录页。
          </p>
        </div>
      </div>
    </div>
  );
}
