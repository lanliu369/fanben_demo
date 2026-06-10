'use client';

import { SystemTooltip } from '@/components/ui/SystemTooltip';

type Props = {
  description?: string;
  label?: string;
};

/** 分类节点说明：名称后 ⓘ，悬停展示 description */
export function ClassificationDescriptionHint({ description, label = '分类说明' }: Props) {
  const text = description?.trim();

  if (!text) return null;

  return (
    <SystemTooltip content={text} align="center" className="inline-flex shrink-0">
      <button
        type="button"
        tabIndex={0}
        aria-label={`${label}：${text}`}
        className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] leading-none text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        ⓘ
      </button>
    </SystemTooltip>
  );
}
