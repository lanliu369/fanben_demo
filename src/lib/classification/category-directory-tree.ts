import type { ClassificationStore } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';

/** 招采分类页目录树层级（1–6），仅本页导航使用 */
export type DirectoryLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const CLASSIFICATION_DIRECTORY_LEVEL_COUNT = 6;

export type DirectoryNodeKind =
  | 'sector'
  | 'energy'
  | 'stage'
  | 'businessType'
  | 'domain'
  | 'lot';

export type DirectoryTreeNode = {
  key: string;
  level: DirectoryLevel;
  kind: DirectoryNodeKind;
  name: string;
  sortOrder: number;
  /** 是否允许填写树形说明（1、4、5 级） */
  allowTreeDescription: boolean;
  description?: string;
  childCount: number;
  children: DirectoryTreeNode[];
  sectorId?: string;
  energyType?: string;
  businessStage?: string;
  businessTypeId?: string;
  domainId?: string;
  lotId?: string;
};

export type DirectoryNavSelection = {
  activeNodeKey?: string;
  businessSectorId?: string;
  businessTypeId?: string;
  navDomainLevelId?: string;
  filterBusinessSectorId?: string;
  selectedLotId?: string;
  energyType?: string;
  businessStage?: string;
};

export const DIRECTORY_LEVEL_LABELS: Record<DirectoryLevel, string> = {
  1: '业务板块',
  2: '能源类型',
  3: '业务阶段',
  4: '业务性质',
  5: '系统/专业/阶段',
  6: '标段级别',
};

/** 允许填写/展示树形说明的目录层级 */
export const DIRECTORY_DESC_LEVELS = new Set<DirectoryLevel>([1, 4, 5]);

export function allowsDirectoryTreeDescription(level: DirectoryLevel): boolean {
  return DIRECTORY_DESC_LEVELS.has(level);
}

const UNASSIGNED_DOMAIN_LABEL = '（无系统/专业/阶段）';

/** 第 5 级占位节点（标段未挂专业域时） */
export function unassignedDomainNodeKey(businessTypeId: string): string {
  return `d:none:${businessTypeId}`;
}

export function isUnassignedDomainNodeKey(key: string): boolean {
  return key.startsWith('d:none:');
}

function sortByOrder<T extends { sortOrder: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh'));
}

function sectorSortOrder(store: ClassificationStore, sectorId: string): number {
  return store.businessSectors.find((s) => s.id === sectorId)?.sortOrder ?? 99;
}

function btSortOrder(store: ClassificationStore, btId: string): number {
  return store.businessTypes.find((b) => b.id === btId)?.sortOrder ?? 99;
}

function domainSortOrder(store: ClassificationStore, domainId: string): number {
  return store.domainLevels.find((d) => d.id === domainId)?.sortOrder ?? 99;
}

function lotSortOrder(store: ClassificationStore, lotId: string): number {
  return store.lotLevels.find((l) => l.id === lotId)?.sortOrder ?? 99;
}

export function buildCategoryDirectoryTree(store: ClassificationStore): DirectoryTreeNode[] {
  const sectors = sortByOrder(
    store.businessSectors.map((s) => ({
      ...s,
      sortOrder: s.sortOrder ?? 99,
    })),
  );

  return sectors.map((sector) => {
    const bts = store.businessTypes.filter((bt) => bt.businessSectorId === sector.id);
    const energyMap = new Map<string, typeof bts>();
    for (const bt of bts) {
      const list = energyMap.get(bt.energyType) ?? [];
      list.push(bt);
      energyMap.set(bt.energyType, list);
    }

    const energyNodes: DirectoryTreeNode[] = sortByOrder(
      [...energyMap.entries()].map(([energyType, group]) => {
        const stageMap = new Map<string, typeof group>();
        for (const bt of group) {
          const list = stageMap.get(bt.businessStage) ?? [];
          list.push(bt);
          stageMap.set(bt.businessStage, list);
        }

        const stageNodes: DirectoryTreeNode[] = sortByOrder(
          [...stageMap.entries()].map(([businessStage, stageGroup]) => {
            const natureNodes: DirectoryTreeNode[] = sortByOrder(
              stageGroup.map((bt) => {
                const domains = store.domainLevels.filter((d) => d.businessTypeId === bt.id);
                const domainNodes: DirectoryTreeNode[] = sortByOrder(
                  domains.map((dl) => {
                    const lots = store.lotLevels.filter((l) => l.domainLevelId === dl.id);
                    const lotNodes: DirectoryTreeNode[] = sortByOrder(
                      lots.map((lot) => ({
                        key: `l:${lot.id}`,
                        level: 6 as const,
                        kind: 'lot' as const,
                        name: lot.name,
                        sortOrder: lotSortOrder(store, lot.id),
                        allowTreeDescription: false,
                        childCount: 0,
                        children: [],
                        sectorId: sector.id,
                        energyType: bt.energyType,
                        businessStage: bt.businessStage,
                        businessTypeId: bt.id,
                        domainId: dl.id,
                        lotId: lot.id,
                      })),
                    );
                    return {
                      key: `d:${dl.id}`,
                      level: 5 as const,
                      kind: 'domain' as const,
                      name: dl.name,
                      sortOrder: domainSortOrder(store, dl.id),
                      allowTreeDescription: allowsDirectoryTreeDescription(5),
                      description: dl.description,
                      childCount: lotNodes.length,
                      children: lotNodes,
                      sectorId: sector.id,
                      energyType: bt.energyType,
                      businessStage: bt.businessStage,
                      businessTypeId: bt.id,
                      domainId: dl.id,
                    };
                  }),
                );

                const directLots = store.lotLevels.filter(
                  (l) => l.businessTypeId === bt.id && !l.domainLevelId,
                );
                const directLotNodes: DirectoryTreeNode[] = sortByOrder(
                  directLots.map((lot) => ({
                    key: `l:${lot.id}`,
                    level: 6 as const,
                    kind: 'lot' as const,
                    name: lot.name,
                    sortOrder: lotSortOrder(store, lot.id),
                    allowTreeDescription: false,
                    childCount: 0,
                    children: [],
                    sectorId: sector.id,
                    energyType: bt.energyType,
                    businessStage: bt.businessStage,
                    businessTypeId: bt.id,
                    lotId: lot.id,
                  })),
                );

                const unassignedNode: DirectoryTreeNode | null =
                  directLotNodes.length > 0
                    ? {
                        key: unassignedDomainNodeKey(bt.id),
                        level: 5,
                        kind: 'domain',
                        name: UNASSIGNED_DOMAIN_LABEL,
                        sortOrder: 99,
                        allowTreeDescription: allowsDirectoryTreeDescription(5),
                        description: bt.unassignedDomainDescription,
                        childCount: directLotNodes.length,
                        children: directLotNodes,
                        sectorId: sector.id,
                        energyType: bt.energyType,
                        businessStage: bt.businessStage,
                        businessTypeId: bt.id,
                      }
                    : null;

                const children = sortByOrder([
                  ...domainNodes,
                  ...(unassignedNode ? [unassignedNode] : []),
                ]);
                return {
                  key: `bt:${bt.id}`,
                  level: 4 as const,
                  kind: 'businessType' as const,
                  name: bt.businessNature,
                  sortOrder: btSortOrder(store, bt.id),
                  allowTreeDescription: allowsDirectoryTreeDescription(4),
                  description: bt.description,
                  childCount: children.length,
                  children,
                  sectorId: sector.id,
                  energyType: bt.energyType,
                  businessStage: bt.businessStage,
                  businessTypeId: bt.id,
                };
              }),
            );

            return {
              key: `st:${sector.id}:${energyType}:${businessStage}`,
              level: 3 as const,
              kind: 'stage' as const,
              name: businessStage,
              sortOrder: Math.min(...stageGroup.map((bt) => btSortOrder(store, bt.id))),
              allowTreeDescription: false,
              childCount: natureNodes.length,
              children: natureNodes,
              sectorId: sector.id,
              energyType,
              businessStage,
            };
          }),
        );

        return {
          key: `e:${sector.id}:${energyType}`,
          level: 2 as const,
          kind: 'energy' as const,
          name: energyType,
          sortOrder: Math.min(...group.map((bt) => btSortOrder(store, bt.id))),
          allowTreeDescription: false,
          childCount: stageNodes.length,
          children: stageNodes,
          sectorId: sector.id,
          energyType,
        };
      }),
    );

    return {
      key: `s:${sector.id}`,
      level: 1,
      kind: 'sector',
      name: sector.name,
      sortOrder: sectorSortOrder(store, sector.id),
      allowTreeDescription: allowsDirectoryTreeDescription(1),
      description: sector.description,
      childCount: energyNodes.length,
      children: energyNodes,
      sectorId: sector.id,
    };
  });
}

export function findDirectoryNode(
  tree: DirectoryTreeNode[],
  key: string,
): DirectoryTreeNode | null {
  for (const node of tree) {
    if (node.key === key) return node;
    const found = findDirectoryNode(node.children, key);
    if (found) return found;
  }
  return null;
}

export function collectDirectoryExpandKeys(tree: DirectoryTreeNode[]): Set<string> {
  const keys = new Set<string>();
  function walk(nodes: DirectoryTreeNode[]) {
    for (const n of nodes) {
      if (n.children.length > 0) keys.add(n.key);
      walk(n.children);
    }
  }
  walk(tree);
  return keys;
}

export function directorySelectionFromNode(node: DirectoryTreeNode): DirectoryNavSelection {
  const base: DirectoryNavSelection = { activeNodeKey: node.key };
  if (node.sectorId) {
    base.businessSectorId = node.sectorId;
    base.filterBusinessSectorId = node.sectorId;
  }
  if (node.energyType) base.energyType = node.energyType;
  if (node.businessStage) base.businessStage = node.businessStage;
  if (node.businessTypeId) base.businessTypeId = node.businessTypeId;
  if (isUnassignedDomainNodeKey(node.key)) {
    base.navDomainLevelId = DOMAIN_LEVEL_NONE_NAV_ID;
  } else if (node.domainId) {
    base.navDomainLevelId = node.domainId;
  }
  if (node.lotId) base.selectedLotId = node.lotId;
  return base;
}

export function findFirstDirectoryNodeKey(tree: DirectoryTreeNode[]): string | undefined {
  function deepest(nodes: DirectoryTreeNode[]): DirectoryTreeNode | undefined {
    for (const n of nodes) {
      if (n.children.length) {
        const d = deepest(n.children);
        if (d) return d;
      }
      return n;
    }
    return undefined;
  }
  return deepest(tree)?.key;
}

export function countDirectoryDescendants(node: DirectoryTreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDirectoryDescendants(c), 0);
}
