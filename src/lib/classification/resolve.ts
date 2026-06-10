import type { ClassificationStore, LotLevelPath } from '@/types';
import {
  formatEvaluationMethods,
  formatProcurementMethods,
  type EvaluationMethod,
  type ProcurementMethod,
} from './constants';
import { getClassificationStore } from './storage';

export function resolveLotLevelPath(
  lotLevelId: string,
  store?: ClassificationStore,
): LotLevelPath | null {
  const s = store ?? getClassificationStore();
  const lot = s.lotLevels.find((l) => l.id === lotLevelId);
  if (!lot) return null;
  const sector = s.businessSectors.find((b) => b.id === lot.businessSectorId);
  const bt = s.businessTypes.find((b) => b.id === lot.businessTypeId);
  const domain = lot.domainLevelId
    ? s.domainLevels.find((d) => d.id === lot.domainLevelId)
    : undefined;
  if (!sector || !bt) return null;
  return {
    lotLevelId: lot.id,
    lotLevelCode: lot.code,
    lotLevelName: lot.name,
    businessSectorId: sector.id,
    businessSectorCode: sector.code,
    businessSectorName: sector.name,
    businessTypeId: bt.id,
    energyType: bt.energyType,
    businessStage: bt.businessStage,
    businessNature: bt.businessNature,
    businessTypeDisplayName: bt.displayName,
    domainLevelId: domain?.id,
    domainLevelName: domain?.name,
    procurementMethods: lot.procurementMethods,
    evaluationMethods: lot.evaluationMethods,
  };
}

export function formatLotBusinessPath(path: LotLevelPath): string {
  const parts = [
    path.businessSectorName,
    path.businessTypeDisplayName,
    path.domainLevelName,
    path.lotLevelName,
  ].filter(Boolean);
  return parts.join(' / ');
}

export function lotPathLabels(path: LotLevelPath) {
  return {
    businessPath: formatLotBusinessPath(path),
    procurement: formatProcurementMethods(path.procurementMethods),
    evaluation: formatEvaluationMethods(path.evaluationMethods),
  };
}

export function templateFieldsFromLotPath(path: LotLevelPath) {
  return {
    lotLevelId: path.lotLevelId,
    lotLevelCode: path.lotLevelCode,
    lotLevelName: path.lotLevelName,
    businessSectorId: path.businessSectorId,
    businessSectorName: path.businessSectorName,
    businessTypeId: path.businessTypeId,
    businessTypeDisplayName: path.businessTypeDisplayName,
    energyType: path.energyType,
    businessStage: path.businessStage,
    businessNature: path.businessNature,
    domainLevelId: path.domainLevelId,
    domainLevelName: path.domainLevelName,
    procurementMethods: path.procurementMethods as ProcurementMethod[],
    evaluationMethods: path.evaluationMethods as EvaluationMethod[],
  };
}
