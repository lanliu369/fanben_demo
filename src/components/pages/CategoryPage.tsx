'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Building2,
  ClipboardList,
  Download,
  FolderTree,
  Layers,
  Zap,
} from 'lucide-react';
import type { ClassificationStore, LotLevel } from '@/types';
import { appendDataAudit, getCategoryAuditLogs, getMockActor } from '@/lib/dataAudit';
import { OperationLogDialog } from '@/components/ui/OperationLogDialog';
import { ClassificationNavPanel } from '@/components/classification/ClassificationNavPanel';
import { CategoryDirectoryWorkspace } from '@/components/classification/CategoryDirectoryWorkspace';
import { DirectoryNodeFormDialog } from '@/components/classification/DirectoryNodeFormDialog';
import { categoryUi } from '@/components/classification/category-ui';
import { deleteLotLevel, getClassificationStats } from '@/lib/classification';
import { exportLotsToFile } from '@/lib/classification/import-export';
import { getClassificationStore } from '@/lib/classification/storage';
import { StatCard } from '@/components/ui/StatCard';
import {
  buildCategoryDirectoryTree,
  collectDirectoryExpandKeys,
  directorySelectionFromNode,
  findDirectoryNode,
  findFirstDirectoryNodeKey,
  type DirectoryLevel,
  type DirectoryNavSelection,
  type DirectoryTreeNode,
} from '@/lib/classification/category-directory-tree';
import { buildDirectoryDetailPanel } from '@/lib/classification/category-directory-detail';
import { buildDirectoryBreadcrumb } from '@/lib/classification/category-tree-nav';
import { filterCategoryDirectoryTree } from '@/lib/classification/category-tree-search';
import {
  deleteDirectoryNode,
  saveDirectoryNode,
  type DirectoryFormContext,
  type DirectoryFormInput,
} from '@/lib/classification/category-directory-crud';

function countEnergyGroups(store: ClassificationStore): number {
  const keys = new Set<string>();
  for (const bt of store.businessTypes) {
    keys.add(`${bt.businessSectorId}:${bt.energyType}`);
  }
  return keys.size;
}

function countStageGroups(store: ClassificationStore): number {
  const keys = new Set<string>();
  for (const bt of store.businessTypes) {
    keys.add(`${bt.businessSectorId}:${bt.energyType}:${bt.businessStage}`);
  }
  return keys.size;
}

function CategoryPageContent() {
  const [store, setStore] = useState<ClassificationStore>(() => getClassificationStore());
  const [navSelection, setNavSelection] = useState<DirectoryNavSelection>({});
  const [treeSearch, setTreeSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [showLog, setShowLog] = useState(false);
  const [showDirectoryForm, setShowDirectoryForm] = useState(false);
  const [directoryFormContext, setDirectoryFormContext] = useState<DirectoryFormContext | null>(
    null,
  );
  const [directoryFormError, setDirectoryFormError] = useState<string | null>(null);
  const [initialTreeDone, setInitialTreeDone] = useState(false);

  const refresh = useCallback(() => {
    setStore(getClassificationStore());
  }, []);

  const directoryTree = useMemo(() => buildCategoryDirectoryTree(store), [store]);
  const classificationStats = useMemo(() => getClassificationStats(store), [store]);

  const activeNode = useMemo(
    () =>
      navSelection.activeNodeKey
        ? findDirectoryNode(directoryTree, navSelection.activeNodeKey)
        : null,
    [directoryTree, navSelection.activeNodeKey],
  );

  const directoryPanel = useMemo(() => {
    if (!activeNode) return null;
    const breadcrumb = buildDirectoryBreadcrumb(directoryTree, activeNode.key);
    return buildDirectoryDetailPanel(store, activeNode, breadcrumb);
  }, [activeNode, directoryTree, store]);

  const logEntries = useMemo(() => (showLog ? getCategoryAuditLogs() : []), [showLog]);

  useEffect(() => {
    if (initialTreeDone) return;
    const firstKey = findFirstDirectoryNodeKey(directoryTree);
    if (!firstKey) {
      setInitialTreeDone(true);
      return;
    }
    const node = findDirectoryNode(directoryTree, firstKey);
    if (node) {
      setNavSelection(directorySelectionFromNode(node));
      const keys = collectDirectoryExpandKeys(directoryTree);
      buildDirectoryBreadcrumb(directoryTree, node.key)
        .slice(0, -1)
        .forEach((b) => keys.add(b.key));
      setExpandedKeys(keys);
    }
    setInitialTreeDone(true);
  }, [directoryTree, initialTreeDone]);

  useEffect(() => {
    if (!treeSearch.trim()) return;
    const { expandKeys } = filterCategoryDirectoryTree(directoryTree, treeSearch);
    setExpandedKeys((prev) => new Set([...prev, ...expandKeys]));
  }, [treeSearch, directoryTree]);

  const handleDeleteLot = (lot: LotLevel) => {
    if (!window.confirm(`确定删除标段「${lot.name}」？`)) return;
    if (deleteLotLevel(lot.id)) {
      appendDataAudit({
        scope: 'category',
        action: 'delete',
        entityId: lot.id,
        label: lot.name,
        actor: getMockActor(),
      });
      setNavSelection({});
      refresh();
    }
  };

  const openDirectoryForm = (ctx: DirectoryFormContext) => {
    setDirectoryFormContext(ctx);
    setDirectoryFormError(null);
    setShowDirectoryForm(true);
  };

  const handleDirectorySubmit = (input: DirectoryFormInput) => {
    if (!directoryFormContext) return;
    const result = saveDirectoryNode(directoryFormContext, input);
    if (!result.ok) {
      setDirectoryFormError(result.error);
      return;
    }
    appendDataAudit({
      scope: 'category',
      action: directoryFormContext.mode === 'add' ? 'create' : 'update',
      detail: `${directoryFormContext.mode === 'add' ? '新增' : '编辑'}目录 ${input.name}`,
      actor: getMockActor(),
    });
    setShowDirectoryForm(false);
    setDirectoryFormContext(null);
    setDirectoryFormError(null);
    refresh();
    const node = findDirectoryNode(buildCategoryDirectoryTree(getClassificationStore()), result.nodeKey);
    if (node) {
      setNavSelection(directorySelectionFromNode(node));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        buildDirectoryBreadcrumb(buildCategoryDirectoryTree(getClassificationStore()), node.key)
          .slice(0, -1)
          .forEach((b) => next.add(b.key));
        next.add(node.key);
        return next;
      });
    }
  };

  const handleSelectNode = (node: DirectoryTreeNode) => {
    setNavSelection(directorySelectionFromNode(node));
  };

  const handleAddChild = (parent: DirectoryTreeNode) => {
    if (parent.level >= 6) return;
    const childLevel = (parent.level + 1) as DirectoryLevel;
    if (childLevel === 6) {
      openDirectoryForm({ mode: 'add', level: 6, node: parent });
      return;
    }
    openDirectoryForm({ mode: 'add', level: childLevel, parentKind: parent.kind, node: parent });
  };

  const handleEditNode = (node: DirectoryTreeNode) => {
    openDirectoryForm({ mode: 'edit', level: node.level, node });
  };

  const handleExportLots = () => {
    if (store.lotLevels.length === 0) {
      window.alert('暂无标段数据可导出');
      return;
    }
    const { detail } = exportLotsToFile('all', 'xlsx', store);
    appendDataAudit({
      scope: 'category',
      action: 'export',
      detail,
      actor: getMockActor(),
    });
  };

  const handleDeleteNode = (node: DirectoryTreeNode) => {
    if (node.kind === 'lot' && node.lotId) {
      const lot = store.lotLevels.find((l) => l.id === node.lotId);
      if (lot) handleDeleteLot(lot);
      return;
    }
    const result = deleteDirectoryNode(node);
    if (result.ok) {
      appendDataAudit({
        scope: 'category',
        action: 'delete',
        label: node.name,
        detail: `删除目录 ${node.name}`,
        actor: getMockActor(),
      });
      setNavSelection({});
      refresh();
    }
  };

  return (
    <div className={categoryUi.page}>
      <OperationLogDialog
        open={showLog}
        onClose={() => setShowLog(false)}
        title="招采分类操作日志"
        entries={logEntries}
      />
      <DirectoryNodeFormDialog
        open={showDirectoryForm}
        context={directoryFormContext}
        onClose={() => {
          setShowDirectoryForm(false);
          setDirectoryFormContext(null);
          setDirectoryFormError(null);
        }}
        onSubmit={handleDirectorySubmit}
        error={directoryFormError}
      />
      <div
        className="grid grid-cols-3 lg:grid-cols-6 gap-3"
        style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
      >
        <StatCard
          compact
          title="业务板块"
          value={classificationStats.businessSectorCount}
          subtext="第 1 级"
          icon={<Building2 className="w-4 h-4 text-blue-600" />}
          iconBgClassName="bg-blue-50"
        />
        <StatCard
          compact
          title="能源类型"
          value={countEnergyGroups(store)}
          subtext="第 2 级"
          icon={<Zap className="w-4 h-4 text-emerald-600" />}
          iconBgClassName="bg-emerald-50"
        />
        <StatCard
          compact
          title="业务阶段"
          value={countStageGroups(store)}
          subtext="第 3 级"
          icon={<Layers className="w-4 h-4 text-amber-600" />}
          iconBgClassName="bg-amber-50"
        />
        <StatCard
          compact
          title="业务性质"
          value={classificationStats.businessTypeCount}
          subtext="第 4 级"
          icon={<FolderTree className="w-4 h-4 text-violet-600" />}
          iconBgClassName="bg-violet-50"
        />
        <StatCard
          compact
          title="系统/专业/阶段"
          value={classificationStats.domainLevelCount}
          subtext="第 5 级"
          icon={<Boxes className="w-4 h-4 text-pink-600" />}
          iconBgClassName="bg-pink-50"
        />
        <StatCard
          compact
          title="标段级别"
          value={classificationStats.lotLevelCount}
          subtext="第 6 级"
          icon={<FolderTree className="w-4 h-4 text-sky-600" />}
          iconBgClassName="bg-sky-50"
        />
      </div>

      <div className={categoryUi.toolbarRow}>
        <div className="min-w-0">
          <p className={categoryUi.pageDesc}>
            共 6 级：业务板块 → 能源类型 → 业务阶段 → 业务性质 → 系统/专业/阶段 → 标段级别
          </p>
        </div>
        <div className={categoryUi.toolbarActions}>
          <button type="button" onClick={handleExportLots} className={categoryUi.btnSecondary}>
            <span className={categoryUi.toolbarIconViolet}>
              <Download className="w-3.5 h-3.5" />
            </span>
            导出品类
          </button>
          <button type="button" onClick={() => setShowLog(true)} className={categoryUi.btnSecondary}>
            <span className={categoryUi.toolbarIconSlate}>
              <ClipboardList className="w-3.5 h-3.5" />
            </span>
            操作日志
          </button>
        </div>
      </div>

      <div className={categoryUi.shell}>
        <aside className={categoryUi.aside}>
          <ClassificationNavPanel
            tree={directoryTree}
            activeNodeKey={navSelection.activeNodeKey}
            expandedKeys={expandedKeys}
            searchQuery={treeSearch}
            onSearchChange={setTreeSearch}
            onToggleExpand={(key) => {
              setExpandedKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onSelect={handleSelectNode}
            onAddRoot={() => openDirectoryForm({ mode: 'add', level: 1 })}
            onAddChild={handleAddChild}
            onEdit={handleEditNode}
            onDelete={handleDeleteNode}
          />
        </aside>
        <div className={categoryUi.main}>
          <CategoryDirectoryWorkspace
            panel={directoryPanel}
            onBreadcrumbSelect={(key) => {
              const node = findDirectoryNode(directoryTree, key);
              if (node) handleSelectNode(node);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  return <CategoryPageContent />;
}
