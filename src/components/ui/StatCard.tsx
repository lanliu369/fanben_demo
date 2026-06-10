'use client';

import type { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';

export type StatCardProps = {
  title: string;
  value: number | string;
  icon: ReactNode;
  /** 副文案；传 true 时在左侧显示趋势图标 */
  subtext?: string;
  showTrendIcon?: boolean;
  iconBgClassName?: string;
  /** 招采页顶栏：小尺寸横排 */
  compact?: boolean;
  className?: string;
};

export function StatCard({
  title,
  value,
  icon,
  subtext,
  showTrendIcon = false,
  iconBgClassName = 'bg-blue-50',
  compact = false,
  className = '',
}: StatCardProps) {
  const padding = compact ? 'p-3' : 'p-6';
  const titleClass = compact ? 'text-xs text-slate-500 mb-0.5' : 'text-sm text-slate-500 mb-1';
  const valueClass = compact
    ? 'text-xl font-semibold text-slate-900 tabular-nums'
    : 'text-3xl font-semibold text-slate-900';
  const subtextClass = compact ? 'text-xs text-slate-600 truncate' : 'text-sm text-slate-600 truncate';
  const iconWrapClass = compact ? 'p-1.5 rounded-md shrink-0' : 'p-2.5 rounded-lg shrink-0';
  const trendClass = compact ? 'w-3 h-3 text-green-600 shrink-0' : 'w-4 h-4 text-green-600 shrink-0';

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow min-w-0 ${padding} ${className}`}
    >
      <div className={`flex items-center justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className="flex-1 min-w-0">
          <p className={titleClass}>{title}</p>
          <p className={valueClass}>{value}</p>
          {subtext ? (
            <div className={`flex items-center gap-1 min-w-0 ${compact ? 'mt-1' : 'mt-2'}`}>
              {showTrendIcon ? <TrendingUp className={trendClass} /> : null}
              <span className={subtextClass}>{subtext}</span>
            </div>
          ) : null}
        </div>
        <div className={`${iconWrapClass} ${iconBgClassName}`}>{icon}</div>
      </div>
    </div>
  );
}
