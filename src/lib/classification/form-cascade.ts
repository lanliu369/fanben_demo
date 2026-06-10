import type { BusinessType, ClassificationStore } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';

export const LOT_FORM_CUSTOM_NAME = '__custom_lot_name__';

export type LotFormCascadeState = {
  businessSectorId: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelId: string;
};

function sortZh(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN');
}

export function uniqueNonEmpty(values: Iterable<string>): string[] {
  return [...new Set([...values].map((v) => v.trim()).filter(Boolean))].sort(sortZh);
}

export function getLotFormEnergyTypes(store: ClassificationStore, sectorId: string): string[] {
  if (!sectorId) return [];
  return uniqueNonEmpty(
    store.businessTypes
      .filter((bt) => bt.businessSectorId === sectorId)
      .map((bt) => bt.energyType),
  );
}

export function getLotFormBusinessStages(
  store: ClassificationStore,
  sectorId: string,
  energyType: string,
): string[] {
  if (!sectorId) return [];
  return uniqueNonEmpty(
    store.businessTypes
      .filter(
        (bt) =>
          bt.businessSectorId === sectorId && (!energyType || bt.energyType === energyType),
      )
      .map((bt) => bt.businessStage),
  );
}

export function getLotFormBusinessNatures(
  store: ClassificationStore,
  sectorId: string,
  energyType: string,
  businessStage: string,
): string[] {
  if (!sectorId) return [];
  return uniqueNonEmpty(
    store.businessTypes
      .filter((bt) => {
        if (bt.businessSectorId !== sectorId) return false;
        if (energyType && bt.energyType !== energyType) return false;
        if (businessStage && bt.businessStage !== businessStage) return false;
        return true;
      })
      .map((bt) => bt.businessNature),
  );
}

export function resolveLotFormBusinessType(
  store: ClassificationStore,
  state: LotFormCascadeState,
): BusinessType | null {
  const { businessSectorId, energyType, businessStage, businessNature } = state;
  if (!businessSectorId || !energyType || !businessStage || !businessNature) return null;
  return (
    store.businessTypes.find(
      (bt) =>
        bt.businessSectorId === businessSectorId &&
        bt.energyType === energyType &&
        bt.businessStage === businessStage &&
        bt.businessNature === businessNature,
    ) ?? null
  );
}

export function getLotFormDomainLevels(store: ClassificationStore, businessTypeId: string) {
  if (!businessTypeId) return [];
  return store.domainLevels
    .filter((dl) => dl.businessTypeId === businessTypeId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export function hasLotsWithoutDomain(
  store: ClassificationStore,
  businessSectorId: string,
  businessTypeId: string,
): boolean {
  return store.lotLevels.some(
    (l) =>
      l.businessSectorId === businessSectorId &&
      l.businessTypeId === businessTypeId &&
      !l.domainLevelId,
  );
}

export function getLotFormLotNames(
  store: ClassificationStore,
  state: LotFormCascadeState,
  domainLevelId: string,
): string[] {
  const bt = resolveLotFormBusinessType(store, state);
  if (!bt || !state.businessSectorId || !domainLevelId) return [];
  const lots = store.lotLevels.filter((l) => {
    if (l.businessSectorId !== state.businessSectorId) return false;
    if (l.businessTypeId !== bt.id) return false;
    if (domainLevelId === DOMAIN_LEVEL_NONE_NAV_ID) return !l.domainLevelId;
    return l.domainLevelId === domainLevelId;
  });
  return uniqueNonEmpty(lots.map((l) => l.name));
}
