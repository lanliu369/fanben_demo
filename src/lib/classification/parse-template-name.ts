import type { ClassificationStore, LotLevel } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';
import { lotCascadeFromLotId, type LotCascadeValue } from './lot-cascade';

export type ParseTemplateNameResult = {
  cascade: LotCascadeValue;
  matchedLotIds: string[];
  /** 从名称中识别到的品类要素标签（用于界面提示） */
  matchedLabels: string[];
  warnings: string[];
};

function lotsMatchingName(name: string, store: ClassificationStore): LotLevel[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const sorted = [...store.lotLevels].sort((a, b) => b.name.length - a.name.length);
  const matched: LotLevel[] = [];
  for (const lot of sorted) {
    if (lot.name && trimmed.includes(lot.name)) {
      matched.push(lot);
    }
  }
  const seen = new Set<string>();
  return matched.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

function scoreBusinessTypeInName(
  name: string,
  store: ClassificationStore,
  sectorId: string,
): { btId: string; score: number; labels: string[] } | null {
  const types = store.businessTypes.filter((bt) => bt.businessSectorId === sectorId);
  let best: { btId: string; score: number; labels: string[] } | null = null;
  for (const bt of types) {
    const labels: string[] = [];
    let score = 0;
    if (bt.energyType && name.includes(bt.energyType)) {
      score += 3;
      labels.push(bt.energyType);
    }
    if (bt.businessStage && name.includes(bt.businessStage)) {
      score += 2;
      labels.push(bt.businessStage);
    }
    if (bt.businessNature && name.includes(bt.businessNature)) {
      score += 2;
      labels.push(bt.businessNature);
    }
    if (bt.displayName && name.includes(bt.displayName)) {
      score += 4;
      labels.push(bt.displayName);
    }
    if (!best || score > best.score) {
      best = { btId: bt.id, score, labels };
    }
  }
  return best && best.score > 0 ? best : null;
}

function domainMatchingName(
  name: string,
  store: ClassificationStore,
  businessTypeId: string,
): string {
  const domains = store.domainLevels.filter((d) => d.businessTypeId === businessTypeId);
  const sorted = [...domains].sort((a, b) => b.name.length - a.name.length);
  for (const d of sorted) {
    if (d.name && name.includes(d.name)) return d.id;
  }
  return '';
}

function lotsUnderCascade(
  store: ClassificationStore,
  cascade: LotCascadeValue,
): LotLevel[] {
  const matchedBt = store.businessTypes.find(
    (bt) =>
      bt.businessSectorId === cascade.businessSectorId
      && bt.energyType === cascade.energyType
      && bt.businessStage === cascade.businessStage
      && bt.businessNature === cascade.businessNature,
  );
  if (!matchedBt || !cascade.domainLevelId) return [];
  return store.lotLevels.filter((l) => {
    if (l.businessSectorId !== cascade.businessSectorId) return false;
    if (l.businessTypeId !== matchedBt.id) return false;
    if (cascade.domainLevelId === DOMAIN_LEVEL_NONE_NAV_ID) return !l.domainLevelId;
    return l.domainLevelId === cascade.domainLevelId;
  });
}

/** 根据范本名称拆分并匹配品类目录各层级（品类单选） */
export function parseTemplateName(
  name: string,
  store: ClassificationStore,
): ParseTemplateNameResult {
  const trimmed = name.trim();
  const warnings: string[] = [];
  const matchedLabels: string[] = [];

  if (!trimmed) {
    return {
      cascade: {
        businessSectorId: '',
        energyType: '',
        businessStage: '',
        businessNature: '',
        domainLevelId: '',
        lotLevelId: '',
      },
      matchedLotIds: [],
      matchedLabels,
      warnings,
    };
  }

  const lotsInName = lotsMatchingName(trimmed, store);
  if (lotsInName.length > 0) {
    const primary = lotsInName[0];
    const cascade = lotCascadeFromLotId(store, primary.id);
    const compatibleIds = lotsInName
      .filter((l) => {
        const c = lotCascadeFromLotId(store, l.id);
        return (
          c.businessSectorId === cascade.businessSectorId
          && c.energyType === cascade.energyType
          && c.businessStage === cascade.businessStage
          && c.businessNature === cascade.businessNature
          && c.domainLevelId === cascade.domainLevelId
        );
      })
      .map((l) => l.id);
    const selectedLotId = compatibleIds[0] ?? '';

    const sector = store.businessSectors.find((s) => s.id === cascade.businessSectorId);
    if (sector) matchedLabels.push(sector.name);
    const bt = store.businessTypes.find((b) => b.id === primary.businessTypeId);
    if (bt?.displayName) matchedLabels.push(bt.displayName);
    if (cascade.domainLevelId && cascade.domainLevelId !== DOMAIN_LEVEL_NONE_NAV_ID) {
      const domain = store.domainLevels.find((d) => d.id === cascade.domainLevelId);
      if (domain) matchedLabels.push(domain.name);
    }
    const selectedLot = lotsInName.find((x) => x.id === selectedLotId);
    if (selectedLot) matchedLabels.push(selectedLot.name);

    if (compatibleIds.length > 1) {
      warnings.push(`名称中识别到 ${compatibleIds.length} 个品类，已选用第一个`);
    }

    return {
      cascade: { ...cascade, lotLevelId: selectedLotId },
      matchedLotIds: selectedLotId ? [selectedLotId] : [],
      matchedLabels: [...new Set(matchedLabels)],
      warnings,
    };
  }

  let businessSectorId = '';
  const sectors = [...store.businessSectors].sort((a, b) => b.name.length - a.name.length);
  for (const s of sectors) {
    if (s.name && trimmed.includes(s.name)) {
      businessSectorId = s.id;
      matchedLabels.push(s.name);
      break;
    }
  }

  let energyType = '';
  let businessStage = '';
  let businessNature = '';
  if (businessSectorId) {
    const btMatch = scoreBusinessTypeInName(trimmed, store, businessSectorId);
    if (btMatch) {
      const bt = store.businessTypes.find((b) => b.id === btMatch.btId);
      if (bt) {
        energyType = bt.energyType;
        businessStage = bt.businessStage;
        businessNature = bt.businessNature;
        matchedLabels.push(...btMatch.labels);
      }
    }
  }

  const matchedBt = store.businessTypes.find(
    (bt) =>
      bt.businessSectorId === businessSectorId
      && bt.energyType === energyType
      && bt.businessStage === businessStage
      && bt.businessNature === businessNature,
  );

  let domainLevelId = '';
  if (matchedBt) {
    domainLevelId = domainMatchingName(trimmed, store, matchedBt.id);
    if (domainLevelId) {
      const d = store.domainLevels.find((x) => x.id === domainLevelId);
      if (d) matchedLabels.push(d.name);
    } else if (
      store.lotLevels.some(
        (l) => l.businessTypeId === matchedBt.id && !l.domainLevelId,
      )
    ) {
      domainLevelId = DOMAIN_LEVEL_NONE_NAV_ID;
    }
  }

  const cascade: LotCascadeValue = {
    businessSectorId,
    energyType,
    businessStage,
    businessNature,
    domainLevelId,
    lotLevelId: '',
  };

  const availableLots = lotsUnderCascade(store, cascade);
  if (availableLots.length === 0 && matchedLabels.length === 0) {
    warnings.push('未从名称中识别到品类要素，请确认名称包含准确的品类名称');
  } else if (availableLots.length > 0 && lotsInName.length === 0) {
    warnings.push('已匹配上级品类，请在下拉中选择品类级别');
  }

  return {
    cascade,
    matchedLotIds: [],
    matchedLabels: [...new Set(matchedLabels)],
    warnings,
  };
}

const TEMPLATE_NAME_SUFFIX = '招标范本';

/** 新建范本：业务板块 + 能源类型 + 业务阶段 + 品类名称 + 招标范本 */
export function buildAutoTemplateName(
  store: ClassificationStore,
  lotLevelId: string,
): string {
  const lot = store.lotLevels.find((l) => l.id === lotLevelId);
  if (!lot) return '';
  const sector = store.businessSectors.find((s) => s.id === lot.businessSectorId);
  const bt = store.businessTypes.find((b) => b.id === lot.businessTypeId);
  const prefix = [
    sector?.name ?? '',
    bt?.energyType ?? '',
    bt?.businessStage ?? '',
    lot.name,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('');
  if (!prefix) return '';
  return `${prefix}${TEMPLATE_NAME_SUFFIX}`;
}
