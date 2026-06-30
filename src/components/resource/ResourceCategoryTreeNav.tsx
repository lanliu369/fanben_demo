'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ClassificationStore } from '@/types';
import { ClassificationNavPanel } from '@/components/classification/ClassificationNavPanel';
import {
  buildCategoryDirectoryTree,
  type DirectoryTreeNode,
} from '@/lib/classification/category-directory-tree';
import { filterCategoryDirectoryTree } from '@/lib/classification/category-tree-search';

type Props = {
  store: ClassificationStore;
  selectedLotLevelId: string;
  onSelectLotLevel: (lotLevelId: string, lotName: string) => void;
  resourceCountByLotId: ReadonlyMap<string, number>;
  onCreate?: () => void;
  canCreate?: boolean;
};

export function ResourceCategoryTreeNav({
  store,
  selectedLotLevelId,
  onSelectLotLevel,
  resourceCountByLotId,
  onCreate,
  canCreate = true,
}: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const tree = useMemo(() => buildCategoryDirectoryTree(store), [store]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const { expandKeys } = filterCategoryDirectoryTree(tree, searchQuery);
    setExpandedKeys((prev) => new Set([...prev, ...expandKeys]));
  }, [searchQuery, tree]);

  const handleToggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelect = (node: DirectoryTreeNode) => {
    if (node.level === 6 && node.lotId) {
      onSelectLotLevel(node.lotId, node.name);
      return;
    }
    if (node.children.length > 0) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.add(node.key);
        return next;
      });
    }
  };

  const activeNodeKey = selectedLotLevelId ? `l:${selectedLotLevelId}` : undefined;

  return (
    <aside className="w-[340px] shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm min-h-0 overflow-hidden">
      <ClassificationNavPanel
        tree={tree}
        activeNodeKey={activeNodeKey}
        expandedKeys={expandedKeys}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        readOnly
        resourceCountByLotId={resourceCountByLotId}
        headerAction={
          onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              disabled={!canCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              新增
            </button>
          ) : undefined
        }
      />
    </aside>
  );
}
