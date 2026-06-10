'use client';

import type { Template } from '@/types';
import { formatTemplateClassification } from '@/components/editor/templateEditorMeta';

function TemplateStatusBadge({ status }: { status: Template['status'] }) {
  const map = {
    draft: { cls: 'bg-slate-100 text-slate-600', label: '草稿' },
    published: { cls: 'bg-emerald-50 text-emerald-700', label: '已发布' },
  };
  const { cls, label } = map[status];
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium leading-none ${cls}`}>
      {label}
    </span>
  );
}

type Props = {
  template: Template;
  /** 编辑器类型说明，如 OnlyOffice / 金山 WPS */
  editorLabel?: string;
};

/** 编辑器顶栏：范本名称 + 招采分类 / 版本 / 状态 */
export function TemplateEditorTitleBlock({ template, editorLabel }: Props) {
  const classification = formatTemplateClassification(template);

  return (
    <div className="min-w-0 flex-1">
      <p className="text-base font-semibold text-slate-900 truncate">{template.name}</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-0.5 text-xs">
        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
          <span className="text-slate-400 shrink-0">所属招采分类</span>
          <span
            className="text-slate-700 truncate"
            title={classification}
          >
            {classification}
          </span>
        </span>
        <span className="text-slate-200 hidden sm:inline">|</span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400">版本号</span>
          <span className="text-slate-700 font-mono tabular-nums">
            {template.version?.trim() || 'V1.0'}
          </span>
        </span>
        <span className="text-slate-200 hidden sm:inline">|</span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400">状态</span>
          <TemplateStatusBadge status={template.status} />
        </span>
        {editorLabel && (
          <>
            <span className="text-slate-200 hidden md:inline">|</span>
            <span className="text-slate-400 hidden md:inline shrink-0">{editorLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
