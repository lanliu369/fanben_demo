'use client';

import { useMemo } from 'react';
import {
  Building2,
  ChevronRight,
  CircleDot,
  FileText,
  Folder,
  Layers,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { categoryUi } from '@/components/classification/category-ui';
import type { DirectoryLevel, DirectoryTreeNode } from '@/lib/classification/category-directory-tree';
import { filterCategoryDirectoryTree } from '@/lib/classification/category-tree-search';

const LEVEL_COLORS: Record<DirectoryLevel, string> = {
  1: 'text-blue-600',
  2: 'text-emerald-600',
  3: 'text-amber-600',
  4: 'text-violet-600',
  5: 'text-pink-600',
  6: 'text-slate-500',
};

function LevelIcon({ level }: { level: DirectoryLevel }) {
  const cls = `w-3.5 h-3.5 shrink-0 ${LEVEL_COLORS[level]}`;
  switch (level) {
    case 1:
      return <Building2 className={cls} strokeWidth={2} />;
    case 2:
      return <Folder className={cls} strokeWidth={2} />;
    case 3:
      return <FileText className={cls} strokeWidth={2} />;
    case 4:
      return <Layers className={cls} strokeWidth={2} />;
    case 5:
      return <Star className={cls} strokeWidth={2} />;
    case 6:
      return <CircleDot className={cls} strokeWidth={2} />;
    default:
      return null;
  }
}

type Props = {
  tree: DirectoryTreeNode[];
  activeNodeKey?: string;
  expandedKeys: Set<string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleExpand: (key: string) => void;
  onSelect: (node: DirectoryTreeNode) => void;
  onAddRoot: () => void;
  onAddChild: (node: DirectoryTreeNode) => void;
  onEdit: (node: DirectoryTreeNode) => void;
  onDelete: (node: DirectoryTreeNode) => void;
};

function TreeNodeRow({
  node,
  depth,
  activeNodeKey,
  expandedKeys,
  onToggleExpand,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: DirectoryTreeNode;
  depth: number;
  activeNodeKey?: string;
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
  onSelect: (node: DirectoryTreeNode) => void;
  onAddChild: (node: DirectoryTreeNode) => void;
  onEdit: (node: DirectoryTreeNode) => void;
  onDelete: (node: DirectoryTreeNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedKeys.has(node.key);
  const active = activeNodeKey === node.key;
  const canAddChild = node.level < 6;
  const showExpandToggle = node.level < 6;

  return (
    <div>
      <div
        className={`${categoryUi.treeRow} ${active ? categoryUi.treeRowActive : ''}`}
        style={{ paddingLeft: 6 + depth * 16 }}
      >
        {showExpandToggle ? (
          <button
            type="button"
            className={`${categoryUi.treeToggle} ${!hasChildren ? 'invisible' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.key);
            }}
            aria-label={expanded ? '收起' : '展开'}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : null}

        <button type="button" className={categoryUi.treeLabelBtn} onClick={() => onSelect(node)}>
          <LevelIcon level={node.level} />
          <span className={`${categoryUi.treeLabel} ${active ? 'text-blue-600 font-medium' : ''}`}>
            {node.name}
          </span>
          {node.allowTreeDescription && node.description?.trim() ? (
            <span
              className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0 opacity-70"
              title="已填写树形说明"
              aria-hidden
            />
          ) : null}
        </button>

        <div
          className={`${categoryUi.treeOps} ${active ? 'flex' : categoryUi.treeOpsHidden}`}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {canAddChild ? (
            <button
              type="button"
              className={categoryUi.treeOpBtn}
              title="新增子目录"
              onClick={() => onAddChild(node)}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <button type="button" className={categoryUi.treeOpBtn} title="编辑" onClick={() => onEdit(node)}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className={`${categoryUi.treeOpBtn} ${categoryUi.treeOpBtnDanger}`}
            title="删除"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && expanded ? (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              activeNodeKey={activeNodeKey}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ClassificationNavPanel({
  tree,
  activeNodeKey,
  expandedKeys,
  searchQuery,
  onSearchChange,
  onToggleExpand,
  onSelect,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
}: Props) {
  const { tree: displayTree } = useMemo(
    () => filterCategoryDirectoryTree(tree, searchQuery),
    [tree, searchQuery],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={categoryUi.treePanelHead}>
        <span className="text-sm font-semibold text-slate-900 shrink-0">目录树</span>
        <button
          type="button"
          className={`${categoryUi.treeIconBtn} text-blue-600 hover:bg-blue-50`}
          title="新增一级目录"
          onClick={onAddRoot}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索目录…"
            className={categoryUi.searchInput}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 min-h-0">
        {displayTree.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">暂无目录数据</p>
        ) : (
          displayTree.map((node) => (
            <TreeNodeRow
              key={node.key}
              node={node}
              depth={0}
              activeNodeKey={activeNodeKey}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
