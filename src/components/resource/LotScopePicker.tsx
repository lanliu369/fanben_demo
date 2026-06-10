'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ClassificationStore } from '@/types';
import {
  buildCategoryDirectoryTree,
  type DirectoryTreeNode,
} from '@/lib/classification/category-directory-tree';

type Props = {
  store: ClassificationStore;
  universal: boolean;
  selectedLotLevelIds: string[];
  onUniversalChange: (value: boolean) => void;
  onToggleLot: (lotLevelId: string, checked: boolean) => void;
};

const LEVEL_ROW_CLASS: Record<number, string> = {
  1: 'text-xs font-medium text-slate-700',
  2: 'text-[11px] font-medium text-emerald-700',
  3: 'text-[11px] font-medium text-amber-700',
  4: 'text-[11px] font-medium text-violet-700',
  5: 'text-[11px] font-medium text-pink-700',
  6: 'text-[11px] text-slate-700',
};

function ScopeTreeNode({
  node,
  depth,
  openKeys,
  onToggleOpen,
  universal,
  selectedSet,
  onToggleLot,
}: {
  node: DirectoryTreeNode;
  depth: number;
  openKeys: Set<string>;
  onToggleOpen: (key: string) => void;
  universal: boolean;
  selectedSet: Set<string>;
  onToggleLot: (lotLevelId: string, checked: boolean) => void;
}) {
  const isLot = node.level === 6 && node.lotId;
  const hasChildren = node.children.length > 0;
  const open = openKeys.has(node.key);
  const pad = 6 + depth * 12;

  if (isLot && node.lotId) {
    return (
      <label
        className="flex items-center gap-2 py-0.5 cursor-pointer"
        style={{ paddingLeft: pad }}
      >
        <input
          type="checkbox"
          checked={selectedSet.has(node.lotId)}
          disabled={universal}
          onChange={(e) => onToggleLot(node.lotId!, e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
        />
        <span className={LEVEL_ROW_CLASS[6]}>{node.name}</span>
      </label>
    );
  }

  return (
    <div>
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggleOpen(node.key)}
          className={`flex items-center gap-1 w-full text-left py-0.5 hover:bg-slate-50 rounded ${LEVEL_ROW_CLASS[node.level] ?? 'text-[11px] text-slate-600'}`}
          style={{ paddingLeft: pad }}
        >
          {open ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-slate-400" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      ) : (
        <div className={`py-0.5 ${LEVEL_ROW_CLASS[node.level]}`} style={{ paddingLeft: pad }}>
          {node.name}
        </div>
      )}
      {open &&
        node.children.map((child) => (
          <ScopeTreeNode
            key={child.key}
            node={child}
            depth={depth + 1}
            openKeys={openKeys}
            onToggleOpen={onToggleOpen}
            universal={universal}
            selectedSet={selectedSet}
            onToggleLot={onToggleLot}
          />
        ))}
    </div>
  );
}

export function LotScopePicker({
  store,
  universal,
  selectedLotLevelIds,
  onUniversalChange,
  onToggleLot,
}: Props) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const selectedSet = useMemo(() => new Set(selectedLotLevelIds), [selectedLotLevelIds]);
  const tree = useMemo(() => buildCategoryDirectoryTree(store), [store]);

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/80 space-y-3">
      <div className="text-xs font-semibold text-slate-700">适用标段范围</div>
      <p className="text-[11px] text-slate-500 leading-snug">
        决定该资源在<strong className="font-medium text-slate-700">哪些标段关联的范本</strong>
        编辑器侧栏中可见；勾选「通用」则所有标段范本均可引用。目录层级与招采分类、范本新建一致（业务板块
        → 能源类型 → 业务阶段 → 业务性质 → 系统/专业/阶段 → 标段级别）。
      </p>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={universal}
          onChange={(e) => onUniversalChange(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-800">通用（全部标段）</span>
      </label>

      <div
        className={`max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 ${
          universal ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {tree.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">暂无招采分类数据</p>
        ) : (
          tree.map((sector) => (
            <ScopeTreeNode
              key={sector.key}
              node={sector}
              depth={0}
              openKeys={openKeys}
              onToggleOpen={toggleOpen}
              universal={universal}
              selectedSet={selectedSet}
              onToggleLot={onToggleLot}
            />
          ))
        )}
      </div>
    </div>
  );
}
