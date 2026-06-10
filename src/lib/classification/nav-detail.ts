import type { BusinessSector, BusinessType, ClassificationStore, DomainLevel, LotLevel } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';
import type { ClassificationNavSelection } from './tree';
import { filterLotLevels, type LotSearchFilters } from './search';
import { formatLotBusinessPath, resolveLotLevelPath } from './resolve';

export type CategoryDetailKind = 'lot' | 'sector' | 'businessType' | 'domain' | 'unassigned' | 'empty';

export type CategoryDetailContext =
  | { kind: 'empty' }
  | {
      kind: 'lot';
      lot: LotLevel;
      path: string;
      pathFull: ReturnType<typeof resolveLotLevelPath>;
    }
  | {
      kind: 'sector';
      sector: BusinessSector;
      childLots: LotLevel[];
    }
  | {
      kind: 'businessType';
      businessType: BusinessType;
      sector: BusinessSector;
      childLots: LotLevel[];
    }
  | {
      kind: 'domain';
      domain: DomainLevel;
      businessType: BusinessType;
      sector: BusinessSector;
      childLots: LotLevel[];
    }
  | {
      kind: 'unassigned';
      businessType: BusinessType;
      sector: BusinessSector;
      childLots: LotLevel[];
    };

export function resolveCategoryDetail(
  store: ClassificationStore,
  selection: ClassificationNavSelection,
  filters: LotSearchFilters,
): CategoryDetailContext {
  if (selection.selectedLotId) {
    const lot = store.lotLevels.find((l) => l.id === selection.selectedLotId);
    if (!lot) return { kind: 'empty' };
    const pathFull = resolveLotLevelPath(lot.id, store);
    return {
      kind: 'lot',
      lot,
      path: pathFull ? formatLotBusinessPath(pathFull) : lot.name,
      pathFull,
    };
  }

  const scoped = filterLotLevels(
    {
      ...filters,
      businessSectorId: selection.filterBusinessSectorId ?? filters.businessSectorId,
      businessTypeId: selection.businessTypeId,
      navDomainLevelId: selection.navDomainLevelId,
    },
    store,
  );

  if (selection.navDomainLevelId && selection.navDomainLevelId !== DOMAIN_LEVEL_NONE_NAV_ID) {
    const domain = store.domainLevels.find((d) => d.id === selection.navDomainLevelId);
    const bt = domain
      ? store.businessTypes.find((b) => b.id === domain.businessTypeId)
      : undefined;
    const sector = bt
      ? store.businessSectors.find((s) => s.id === bt.businessSectorId)
      : undefined;
    if (!domain || !bt || !sector) return { kind: 'empty' };
    return {
      kind: 'domain',
      domain,
      businessType: bt,
      sector,
      childLots: scoped,
    };
  }

  if (selection.navDomainLevelId === DOMAIN_LEVEL_NONE_NAV_ID && selection.businessTypeId) {
    const bt = store.businessTypes.find((b) => b.id === selection.businessTypeId);
    const sector = bt
      ? store.businessSectors.find((s) => s.id === bt.businessSectorId)
      : undefined;
    if (!bt || !sector) return { kind: 'empty' };
    return {
      kind: 'unassigned',
      businessType: bt,
      sector,
      childLots: scoped.filter((l) => !l.domainLevelId),
    };
  }

  if (selection.businessTypeId) {
    const bt = store.businessTypes.find((b) => b.id === selection.businessTypeId);
    const sector = bt
      ? store.businessSectors.find((s) => s.id === bt.businessSectorId)
      : undefined;
    if (!bt || !sector) return { kind: 'empty' };
    return {
      kind: 'businessType',
      businessType: bt,
      sector,
      childLots: scoped,
    };
  }

  const sectorId = selection.filterBusinessSectorId ?? filters.businessSectorId;
  if (sectorId) {
    const sector = store.businessSectors.find((s) => s.id === sectorId);
    if (!sector) return { kind: 'empty' };
    return {
      kind: 'sector',
      sector,
      childLots: scoped,
    };
  }

  return { kind: 'empty' };
}

export function descriptionTargetFromDetail(
  detail: CategoryDetailContext,
): import('./crud').NodeDescriptionTarget | null {
  if (detail.kind === 'sector') return { kind: 'sector', id: detail.sector.id };
  if (detail.kind === 'businessType') return { kind: 'businessType', id: detail.businessType.id };
  if (detail.kind === 'domain') return { kind: 'domain', id: detail.domain.id };
  return null;
}

export function detailTitle(detail: CategoryDetailContext): string {
  switch (detail.kind) {
    case 'lot':
      return detail.lot.name;
    case 'sector':
      return detail.sector.name;
    case 'businessType':
      return detail.businessType.displayName;
    case 'domain':
      return detail.domain.name;
    case 'unassigned':
      return '（无系统/专业/阶段）';
    default:
      return '招采分类';
  }
}

export function detailSubtitle(detail: CategoryDetailContext, store: ClassificationStore): string {
  switch (detail.kind) {
    case 'lot':
      return detail.path;
    case 'sector':
      return '业务板块';
    case 'businessType':
      return [detail.sector.name, detail.businessType.displayName].join(' / ');
    case 'domain':
      return [
        detail.sector.name,
        detail.businessType.displayName,
        detail.domain.name,
      ].join(' / ');
    case 'unassigned':
      return [detail.sector.name, detail.businessType.displayName].join(' / ');
    default:
      return '请在左侧选择分类节点';
  }
}
