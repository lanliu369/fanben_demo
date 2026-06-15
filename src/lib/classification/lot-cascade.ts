import type { ClassificationStore } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';

export type LotCascadeValue = {
  businessSectorId: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelId: string;
  lotLevelId: string;
};

export function emptyLotCascade(): LotCascadeValue {
  return {
    businessSectorId: '',
    energyType: '',
    businessStage: '',
    businessNature: '',
    domainLevelId: '',
    lotLevelId: '',
  };
}

export function lotCascadeFromLotId(
  store: ClassificationStore,
  lotLevelId: string,
): LotCascadeValue {
  const lot = store.lotLevels.find((l) => l.id === lotLevelId);
  if (!lot) return emptyLotCascade();
  const bt = store.businessTypes.find((b) => b.id === lot.businessTypeId);
  return {
    businessSectorId: lot.businessSectorId,
    energyType: bt?.energyType ?? '',
    businessStage: bt?.businessStage ?? '',
    businessNature: bt?.businessNature ?? '',
    domainLevelId: lot.domainLevelId ?? DOMAIN_LEVEL_NONE_NAV_ID,
    lotLevelId: lot.id,
  };
}
