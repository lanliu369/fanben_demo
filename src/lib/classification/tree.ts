import type { BusinessType, ClassificationStore, DomainLevel, LotLevel } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';

export type BusinessTypeNavBranch = {
  businessType: BusinessType;
  domainLevels: DomainLevel[];
  unassignedLotCount: number;
  hasThirdLevel: boolean;
};

export type ClassificationNavLotNode = {
  kind: 'lot';
  id: string;
  name: string;
  businessTypeId: string;
  domainLevelId?: string;
};

export type ClassificationNavDomainNode = {
  kind: 'domain';
  id: string;
  name: string;
  description?: string;
  businessTypeId: string;
  lotCount: number;
  lots: ClassificationNavLotNode[];
};

export type ClassificationNavUnassignedNode = {
  kind: 'unassigned';
  businessTypeId: string;
  lotCount: number;
  lots: ClassificationNavLotNode[];
};

export type ClassificationNavBusinessTypeNode = {
  kind: 'businessType';
  id: string;
  displayName: string;
  description?: string;
  lotCount: number;
  domains: ClassificationNavDomainNode[];
  unassigned: ClassificationNavUnassignedNode | null;
  hasThirdLevel: boolean;
  /** 无第三级时，品类直接挂在业务类型下 */
  directLots: ClassificationNavLotNode[];
};

export type ClassificationNavSectorNode = {
  kind: 'sector';
  id: string;
  name: string;
  description?: string;
  lotCount: number;
  businessTypes: ClassificationNavBusinessTypeNode[];
};

export type ClassificationNavTree = ClassificationNavSectorNode[];

export type LotCountMaps = {
  bySector: Map<string, number>;
  byBusinessType: Map<string, number>;
  byDomainLevel: Map<string, number>;
};

export type ClassificationNavSelection = {
  businessSectorId?: string;
  businessTypeId?: string;
  navDomainLevelId?: string;
  filterBusinessSectorId?: string;
  /** 树形模式：选中的品类叶子节点 */
  selectedLotId?: string;
};

export function computeLotCountMaps(store: ClassificationStore): LotCountMaps {
  const bySector = new Map<string, number>();
  const byBusinessType = new Map<string, number>();
  const byDomainLevel = new Map<string, number>();
  for (const lot of store.lotLevels) {
    bySector.set(lot.businessSectorId, (bySector.get(lot.businessSectorId) ?? 0) + 1);
    byBusinessType.set(lot.businessTypeId, (byBusinessType.get(lot.businessTypeId) ?? 0) + 1);
    if (lot.domainLevelId) {
      byDomainLevel.set(lot.domainLevelId, (byDomainLevel.get(lot.domainLevelId) ?? 0) + 1);
    }
  }
  return { bySector, byBusinessType, byDomainLevel };
}

/** 构建四级分类导航树（业务板块 → 业务类型 → 专业域 → 品类） */
export function buildClassificationNavTree(store: ClassificationStore): ClassificationNavTree {
  const counts = computeLotCountMaps(store);
  return store.businessSectors.map((sector) => {
    const businessTypes = store.businessTypes
      .filter((bt) => bt.businessSectorId === sector.id)
      .map((bt) => {
        const branch = getBusinessTypeNavBranch(bt.id, store);
        const btLots = store.lotLevels.filter((l) => l.businessTypeId === bt.id);
        const domains: ClassificationNavDomainNode[] = (branch?.domainLevels ?? []).map((dl) => {
          const domainLots = btLots
            .filter((l) => l.domainLevelId === dl.id)
            .map((l) => ({
              kind: 'lot' as const,
              id: l.id,
              name: l.name,
              businessTypeId: bt.id,
              domainLevelId: dl.id,
            }));
          return {
            kind: 'domain' as const,
            id: dl.id,
            name: dl.name,
            description: dl.description,
            businessTypeId: bt.id,
            lotCount: domainLots.length,
            lots: domainLots,
          };
        });
        const directLots = btLots
          .filter((l) => !l.domainLevelId)
          .map((l) => ({
            kind: 'lot' as const,
            id: l.id,
            name: l.name,
            businessTypeId: bt.id,
          }));
        const unassignedLots = directLots;
        const unassigned: ClassificationNavUnassignedNode | null =
          unassignedLots.length > 0
            ? {
                kind: 'unassigned',
                businessTypeId: bt.id,
                lotCount: unassignedLots.length,
                lots: unassignedLots,
              }
            : null;
        return {
          kind: 'businessType' as const,
          id: bt.id,
          displayName: bt.displayName,
          description: bt.description,
          lotCount: counts.byBusinessType.get(bt.id) ?? 0,
          domains,
          unassigned,
          hasThirdLevel: branch?.hasThirdLevel ?? false,
          directLots,
        };
      });
    return {
      kind: 'sector' as const,
      id: sector.id,
      name: sector.name,
      description: sector.description,
      lotCount: counts.bySector.get(sector.id) ?? 0,
      businessTypes,
    };
  });
}

export function getBusinessTypeNavBranch(
  businessTypeId: string,
  store: ClassificationStore,
): BusinessTypeNavBranch | null {
  const businessType = store.businessTypes.find((bt) => bt.id === businessTypeId);
  if (!businessType) return null;
  const domainLevels = store.domainLevels.filter((d) => d.businessTypeId === businessTypeId);
  const lots = store.lotLevels.filter((l) => l.businessTypeId === businessTypeId);
  const unassignedLotCount = lots.filter((l) => !l.domainLevelId).length;
  return {
    businessType,
    domainLevels,
    unassignedLotCount,
    hasThirdLevel: domainLevels.length > 0 || unassignedLotCount > 0,
  };
}

export function isDomainNoneNav(navDomainLevelId?: string): boolean {
  return navDomainLevelId === DOMAIN_LEVEL_NONE_NAV_ID;
}

export function isLotNavActive(lotId: string, sel: ClassificationNavSelection): boolean {
  return sel.selectedLotId === lotId;
}

export function isSectorNavActive(
  sectorId: string,
  sel: ClassificationNavSelection,
): boolean {
  return (
    !sel.selectedLotId &&
    sel.filterBusinessSectorId === sectorId &&
    !sel.businessTypeId &&
    !sel.navDomainLevelId
  );
}

export function isBusinessTypeNavActive(
  businessTypeId: string,
  sel: ClassificationNavSelection,
): boolean {
  return (
    !sel.selectedLotId &&
    sel.businessTypeId === businessTypeId &&
    sel.navDomainLevelId !== DOMAIN_LEVEL_NONE_NAV_ID &&
    !sel.navDomainLevelId
  );
}

export function isBusinessTypeInNavPath(businessTypeId: string, sel: ClassificationNavSelection): boolean {
  return sel.businessTypeId === businessTypeId;
}

export function isDomainNavActive(domainId: string, sel: ClassificationNavSelection): boolean {
  return !sel.selectedLotId && sel.navDomainLevelId === domainId;
}

export function isUnassignedNavActive(businessTypeId: string, sel: ClassificationNavSelection): boolean {
  return (
    !sel.selectedLotId &&
    sel.navDomainLevelId === DOMAIN_LEVEL_NONE_NAV_ID &&
    sel.businessTypeId === businessTypeId
  );
}

/** 树加载后默认选中第一个品类 */
export function findFirstLotIdInTree(tree: ClassificationNavTree): string | undefined {
  for (const sector of tree) {
    for (const bt of sector.businessTypes) {
      for (const dl of bt.domains) {
        if (dl.lots[0]) return dl.lots[0].id;
      }
      if (bt.directLots[0]) return bt.directLots[0].id;
    }
  }
  return undefined;
}
