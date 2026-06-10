'use client';

import type { ReactNode } from 'react';
import { AlertCircle, FolderTree } from 'lucide-react';

export type HintPanelTone = 'info' | 'warning';

export type HintPanelProps = {
  title: string;
  description: string;
  tone?: HintPanelTone;
  meta?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

const toneStyles: Record<HintPanelTone, { box: string; icon: string }> = {
  info: { box: 'bg-blue-50', icon: 'text-blue-600' },
  warning: { box: 'bg-amber-50', icon: 'text-amber-600' },
};

export function HintPanel({
  title,
  description,
  tone = 'info',
  meta,
  icon,
  action,
  className = '',
}: HintPanelProps) {
  const s = toneStyles[tone];
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50/80 transition-colors ${className}`}
    >
      <div className={`p-2 rounded-lg shrink-0 ${s.box}`}>
        {icon ?? <AlertCircle className={`w-5 h-5 ${s.icon}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
        {meta ? <p className="text-xs text-slate-400 mt-2">{meta}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

/** 招采详情空状态默认图标 */
export function CategoryEmptyIcon() {
  return <FolderTree className="w-5 h-5 text-blue-600" />;
}
