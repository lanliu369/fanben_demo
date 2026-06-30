import type { ReactNode } from 'react';
import type { ClassificationStore } from '@/types';
import {
  formatEvaluationMethods,
  formatProcurementMethods,
} from './constants';
import type { DirectoryTreeNode } from './category-directory-tree';
import {
  allowsDirectoryTreeDescription,
  DIRECTORY_LEVEL_LABELS,
  countDirectoryDescendants,
  isUnassignedDomainNodeKey,
} from './category-directory-tree';
import { directoryLevelTag } from './category-tree-nav';
import { resolveLotLevelPath, formatLotBusinessPath } from './resolve';

export type DirectoryDetailPanel = {
  node: DirectoryTreeNode;
  breadcrumb: { key: string; name: string }[];
  levelLabel: string;
  title: string;
  meta: { childCount: number; sortOrder: number; descendantCount: number };
  infoRows: { label: string; value: ReactNode }[];
  treeDescription?: string;
  showTreeDescription: boolean;
};

export function buildDirectoryDetailPanel(
  store: ClassificationStore,
  node: DirectoryTreeNode,
  breadcrumb: { key: string; name: string }[],
): DirectoryDetailPanel {
  const levelLabel = `${node.level} 级 · ${directoryLevelTag(node.level)}`;
  const descendantCount = countDirectoryDescendants(node);
  const sortOrder = node.sortOrder;
  const showTreeDescription = allowsDirectoryTreeDescription(node.level);

  const baseRows: { label: string; value: ReactNode }[] = [
    { label: '目录名称', value: node.name },
    { label: '层级', value: DIRECTORY_LEVEL_LABELS[node.level] },
    { label: '直属子节点', value: `${node.childCount} 个` },
  ];

  if (node.kind === 'sector' && node.sectorId) {
    const sector = store.businessSectors.find((s) => s.id === node.sectorId);
    return {
      node,
      breadcrumb,
      levelLabel,
      title: node.name,
      meta: { childCount: node.childCount, sortOrder, descendantCount },
      infoRows: [
        ...baseRows.slice(0, 2),
        { label: '板块编码', value: sector?.code ?? '—' },
        ...baseRows.slice(2),
      ],
      treeDescription: showTreeDescription ? node.description : undefined,
      showTreeDescription,
    };
  }

  if (node.kind === 'lot' && node.lotId) {
    const lot = store.lotLevels.find((l) => l.id === node.lotId);
    const pathFull = lot ? resolveLotLevelPath(lot.id, store) : null;
    return {
      node,
      breadcrumb,
      levelLabel,
      title: node.name,
      meta: { childCount: 0, sortOrder, descendantCount: 0 },
      infoRows: [
        { label: '目录名称', value: node.name },
        { label: '层级', value: DIRECTORY_LEVEL_LABELS[6] },
        {
          label: '采购方式',
          value: lot ? formatProcurementMethods(lot.procurementMethods) : '—',
        },
        {
          label: '评审办法',
          value: lot ? formatEvaluationMethods(lot.evaluationMethods) : '—',
        },
        { label: '业务路径', value: pathFull ? formatLotBusinessPath(pathFull) : '—' },
        { label: '更新时间', value: lot?.updatedAt ?? '—' },
      ],
      showTreeDescription: false,
    };
  }

  if (node.kind === 'domain' && isUnassignedDomainNodeKey(node.key) && node.businessTypeId) {
    const bt = store.businessTypes.find((b) => b.id === node.businessTypeId);
    return {
      node,
      breadcrumb,
      levelLabel,
      title: node.name,
      meta: { childCount: node.childCount, sortOrder, descendantCount },
      infoRows: [
        ...baseRows,
        { label: '说明', value: '未配置专业域的品类归集于此（第 5 级）' },
      ],
      treeDescription: showTreeDescription
        ? (bt?.unassignedDomainDescription ?? node.description)
        : undefined,
      showTreeDescription,
    };
  }

  if (node.kind === 'domain' && node.domainId) {
    const dl = store.domainLevels.find((d) => d.id === node.domainId);
    return {
      node,
      breadcrumb,
      levelLabel,
      title: node.name,
      meta: { childCount: node.childCount, sortOrder, descendantCount },
      infoRows: baseRows,
      treeDescription: showTreeDescription ? (dl?.description ?? node.description) : undefined,
      showTreeDescription,
    };
  }

  if (node.kind === 'businessType' && node.businessTypeId) {
    const bt = store.businessTypes.find((b) => b.id === node.businessTypeId);
    return {
      node,
      breadcrumb,
      levelLabel,
      title: node.name,
      meta: { childCount: node.childCount, sortOrder, descendantCount },
      infoRows: [
        ...baseRows,
        { label: '能源类型', value: bt?.energyType ?? '—' },
        { label: '业务阶段', value: bt?.businessStage ?? '—' },
        { label: '组合名称', value: bt?.displayName ?? '—' },
      ],
      treeDescription: showTreeDescription ? node.description : undefined,
      showTreeDescription,
    };
  }

  return {
    node,
    breadcrumb,
    levelLabel,
    title: node.name,
    meta: { childCount: node.childCount, sortOrder, descendantCount },
    infoRows: baseRows,
    treeDescription: showTreeDescription ? node.description : undefined,
    showTreeDescription,
  };
}
