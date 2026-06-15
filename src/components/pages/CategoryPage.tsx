'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Upload } from 'lucide-react';
import type { ClassificationStore, LotLevel } from '@/types';
import { appendDataAudit, getCategoryAuditLogs, getMockActor } from '@/lib/dataAudit';
import { OperationLogDialog } from '@/components/ui/OperationLogDialog';
import { TypedConfirmDeleteDialog } from '@/components/ui/TypedConfirmDeleteDialog';
import { CategoryFileUploadModal } from '@/components/classification/CategoryFileUploadModal';
import { ClassificationNavPanel } from '@/components/classification/ClassificationNavPanel';
import { CategoryDirectoryWorkspace } from '@/components/classification/CategoryDirectoryWorkspace';
import { DirectoryNodeFormDialog } from '@/components/classification/DirectoryNodeFormDialog';
import { categoryUi } from '@/components/classification/category-ui';
import { deleteLotLevel } from '@/lib/classification';
import { getClassificationStore } from '@/lib/classification/storage';
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
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'lot'; lot: LotLevel }
    | { kind: 'directory'; node: DirectoryTreeNode }
    | null
  >(null);

  const refresh = useCallback(() => {
    setStore(getClassificationStore());
  }, []);

  const directoryTree = useMemo(() => buildCategoryDirectoryTree(store), [store]);

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
    setDeleteTarget({ kind: 'lot', lot });
  };

  const confirmDeleteTarget = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'lot') {
      const { lot } = deleteTarget;
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
    } else {
      const { node } = deleteTarget;
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
    }
    setDeleteTarget(null);
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

  const handleDeleteNode = (node: DirectoryTreeNode) => {
    if (node.kind === 'lot' && node.lotId) {
      const lot = store.lotLevels.find((l) => l.id === node.lotId);
      if (lot) handleDeleteLot(lot);
      return;
    }
    setDeleteTarget({ kind: 'directory', node });
  };

  const deleteTargetMessage = useMemo(() => {
    if (!deleteTarget) return '';
    if (deleteTarget.kind === 'lot') {
      return `确定删除标段「${deleteTarget.lot.name}」？删除后不可恢复。`;
    }
    return `确定删除目录「${deleteTarget.node.name}」？删除后不可恢复。`;
  }, [deleteTarget]);

  return (
    <div className={categoryUi.page}>
      <OperationLogDialog
        open={showLog}
        onClose={() => setShowLog(false)}
        title="品类管理操作日志"
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
      <div className={categoryUi.toolbarRow}>
        <div className="min-w-0">
          <p className={categoryUi.pageDesc}>
            共 6 级：业务板块 → 能源类型 → 业务阶段 → 业务性质 → 系统/专业/阶段 → 标段级别
          </p>
        </div>
        <div className={categoryUi.toolbarActions}>
          <button type="button" onClick={() => setShowFileUpload(true)} className={categoryUi.btnSecondary}>
            <span className={categoryUi.toolbarIconGreen}>
              <Upload className="w-3.5 h-3.5" />
            </span>
            文件上传
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

      <CategoryFileUploadModal
        open={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploaded={(entry) => {
          appendDataAudit({
            scope: 'category',
            action: 'import',
            entityId: entry.id,
            label: entry.name,
            detail: `上传 Excel ${entry.name} ${entry.version}（${entry.originalFileName}）`,
            actor: getMockActor(),
          });
        }}
        onDeleted={(entry) => {
          appendDataAudit({
            scope: 'category',
            action: 'delete',
            entityId: entry.id,
            label: entry.name,
            detail: `删除上传文件 ${entry.name} ${entry.version}`,
            actor: getMockActor(),
          });
        }}
      />

      <TypedConfirmDeleteDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={deleteTargetMessage}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTarget}
      />
    </div>
  );
}

export default function CategoryPage() {
  return <CategoryPageContent />;
}
