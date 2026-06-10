'use client';

import type { ReactNode } from 'react';

export type SectionCardProps = {
  title: string;
  /** 标题右侧附加（如数量） */
  titleExtra?: ReactNode;
  children: ReactNode;
  /** 内容区内边距，默认 p-6 */
  bodyClassName?: string;
  className?: string;
};

export function SectionCard({
  title,
  titleExtra,
  children,
  bodyClassName = 'p-6',
  className = '',
}: SectionCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {titleExtra}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
