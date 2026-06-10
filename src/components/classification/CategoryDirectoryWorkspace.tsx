'use client';

import { ChevronRight, Info } from 'lucide-react';
import { categoryUi } from '@/components/classification/category-ui';
import type { DirectoryDetailPanel } from '@/lib/classification/category-directory-detail';
import { HintPanel, CategoryEmptyIcon } from '@/components/ui/HintPanel';

type Props = {
  panel: DirectoryDetailPanel | null;
  onBreadcrumbSelect: (key: string) => void;
};

function levelTagClass(level: number): string {
  const map: Record<number, string> = {
    1: 'bg-blue-50 text-blue-600',
    2: 'bg-emerald-50 text-emerald-700',
    3: 'bg-amber-50 text-amber-700',
    4: 'bg-violet-50 text-violet-700',
    5: 'bg-pink-50 text-pink-700',
    6: 'bg-sky-50 text-sky-700',
  };
  return `inline-flex items-center h-5 px-2 rounded text-[11px] font-medium ${map[level] ?? 'bg-slate-100 text-slate-600'}`;
}

export function CategoryDirectoryWorkspace({ panel, onBreadcrumbSelect }: Props) {
  if (!panel) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        <div className="w-full max-w-lg">
          <HintPanel
            icon={<CategoryEmptyIcon />}
            title="选择左侧目录节点"
            description="点击目录树中的节点查看基本信息；一、四、五级节点还可查看树形说明。"
            meta="编辑、删除请在左侧目录树节点操作"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
      <div className={categoryUi.detailHeader}>
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-slate-500 mb-3 min-w-0">
          {panel.breadcrumb.map((item, i) => (
            <span key={item.key} className="inline-flex items-center gap-1 max-w-full min-w-0">
              {i > 0 ? <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" /> : null}
              {i < panel.breadcrumb.length - 1 ? (
                <button
                  type="button"
                  className="text-blue-600 hover:underline truncate max-w-[8rem] sm:max-w-none"
                  onClick={() => onBreadcrumbSelect(item.key)}
                  title={item.name}
                >
                  {item.name}
                </button>
              ) : (
                <span className="text-slate-700 truncate" title={item.name}>
                  {item.name}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="min-w-0">
          <h2 className={categoryUi.detailHeaderTitle}>{panel.title}</h2>
          <div className={categoryUi.detailHeaderMeta}>
            <span className={levelTagClass(panel.node.level)}>{panel.levelLabel}</span>
            <span className="whitespace-nowrap">共 {panel.meta.descendantCount} 个子节点</span>
          </div>
        </div>
      </div>

      <div className={`${categoryUi.detailBody} space-y-4`}>
        <div className={categoryUi.infoCard}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
            <Info className="w-4 h-4 text-blue-600" />
            基本信息
          </div>
          <div className={categoryUi.detailInfoList}>
            {panel.infoRows.map((row) => (
              <div key={row.label} className={categoryUi.detailInfoRow}>
                <span className={categoryUi.detailInfoLabel}>{row.label}</span>
                <span className={categoryUi.detailInfoValue}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {panel.showTreeDescription ? (
          <div className={categoryUi.infoCard}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
              <FileTextIcon />
              树形说明
            </div>
            {panel.treeDescription?.trim() ? (
              <div className={categoryUi.treeDescBox}>{panel.treeDescription}</div>
            ) : (
              <p className="text-sm text-slate-400 italic pl-1">暂无树形说明</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg
      className="w-4 h-4 text-blue-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
