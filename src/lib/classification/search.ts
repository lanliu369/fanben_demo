import type { ClassificationStore, LotLevel } from '@/types';
import type { EvaluationMethod, ProcurementMethod } from './constants';
import {
  EVALUATION_METHODS,
  EVALUATION_METHOD_LABELS,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_LABELS,
} from './constants';
import { DOMAIN_LEVEL_NONE_NAV_ID } from './constants';
import { formatLotBusinessPath, resolveLotLevelPath } from './resolve';
import { getClassificationStore } from './storage';

export type LotSearchFilters = {
  businessSectorId?: string;
  energyType?: string;
  businessStage?: string;
  businessNature?: string;
  domainLevelId?: string;
  lotName?: string;
  procurementMethod?: ProcurementMethod;
  evaluationMethod?: EvaluationMethod;
  /** 树导航：选中业务类型 */
  businessTypeId?: string;
  /** 树导航：选中专业域 */
  navDomainLevelId?: string;
};

export type LinkedDomainOption = {
  id: string;
  name: string;
  businessTypeId: string;
  label: string;
};

export type LinkedFilterOptions = {
  energyTypes: string[];
  businessStages: string[];
  businessNatures: string[];
  domainLevels: LinkedDomainOption[];
  procurementMethods: ProcurementMethod[];
  evaluationMethods: EvaluationMethod[];
};

type FacetKey = keyof Pick<
  LotSearchFilters,
  | 'businessSectorId'
  | 'energyType'
  | 'businessStage'
  | 'businessNature'
  | 'domainLevelId'
  | 'lotName'
  | 'procurementMethod'
  | 'evaluationMethod'
>;

function filterLotsForFacet(
  filters: LotSearchFilters,
  exclude: FacetKey | FacetKey[],
  store: ClassificationStore,
): LotLevel[] {
  const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude]);
  const f: LotSearchFilters = { ...filters };
  for (const k of excluded) {
    delete f[k];
  }
  return filterLotLevels(f, store);
}

export function filterLotLevels(
  filters: LotSearchFilters,
  store?: ClassificationStore,
): LotLevel[] {
  const s = store ?? getClassificationStore();
  let list = [...s.lotLevels];

  if (filters.businessTypeId) {
    list = list.filter((l) => l.businessTypeId === filters.businessTypeId);
  }
  if (filters.navDomainLevelId === DOMAIN_LEVEL_NONE_NAV_ID) {
    if (filters.businessTypeId) {
      list = list.filter(
        (l) => l.businessTypeId === filters.businessTypeId && !l.domainLevelId,
      );
    } else {
      list = list.filter((l) => !l.domainLevelId);
    }
  } else if (filters.navDomainLevelId) {
    list = list.filter((l) => l.domainLevelId === filters.navDomainLevelId);
  }
  if (filters.businessSectorId) {
    list = list.filter((l) => l.businessSectorId === filters.businessSectorId);
  }
  if (filters.domainLevelId) {
    list = list.filter((l) => l.domainLevelId === filters.domainLevelId);
  }
  if (filters.procurementMethod) {
    list = list.filter((l) => l.procurementMethods.includes(filters.procurementMethod!));
  }
  if (filters.evaluationMethod) {
    list = list.filter((l) => l.evaluationMethods.includes(filters.evaluationMethod!));
  }
  if (filters.lotName?.trim()) {
    const q = filters.lotName.trim().toLowerCase();
    list = list.filter((l) => {
      const path = resolveLotLevelPath(l.id, s);
      if (!path) return l.name.toLowerCase().includes(q);
      return (
        l.name.toLowerCase().includes(q) ||
        path.businessTypeDisplayName.toLowerCase().includes(q) ||
        path.energyType.toLowerCase().includes(q) ||
        path.businessStage.toLowerCase().includes(q) ||
        path.businessNature.toLowerCase().includes(q) ||
        (path.domainLevelName?.toLowerCase().includes(q) ?? false) ||
        path.businessSectorName.toLowerCase().includes(q)
      );
    });
  }
  if (filters.energyType?.trim()) {
    const q = filters.energyType.trim();
    list = list.filter((l) => {
      const bt = s.businessTypes.find((b) => b.id === l.businessTypeId);
      return bt?.energyType === q;
    });
  }
  if (filters.businessStage?.trim()) {
    const q = filters.businessStage.trim();
    list = list.filter((l) => {
      const bt = s.businessTypes.find((b) => b.id === l.businessTypeId);
      return bt?.businessStage === q;
    });
  }
  if (filters.businessNature?.trim()) {
    const q = filters.businessNature.trim();
    list = list.filter((l) => {
      const bt = s.businessTypes.find((b) => b.id === l.businessTypeId);
      return bt?.businessNature === q;
    });
  }

  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 联动筛选项：各下拉仅展示在当前其它条件下仍有结果的取值 */
export function getLinkedFilterOptions(
  filters: LotSearchFilters,
  store?: ClassificationStore,
): LinkedFilterOptions {
  const s = store ?? getClassificationStore();

  const energyTypes = new Set<string>();
  for (const lot of filterLotsForFacet(filters, 'energyType', s)) {
    const bt = s.businessTypes.find((b) => b.id === lot.businessTypeId);
    if (bt) energyTypes.add(bt.energyType);
  }

  const businessStages = new Set<string>();
  for (const lot of filterLotsForFacet(filters, 'businessStage', s)) {
    const bt = s.businessTypes.find((b) => b.id === lot.businessTypeId);
    if (bt) businessStages.add(bt.businessStage);
  }

  const businessNatures = new Set<string>();
  for (const lot of filterLotsForFacet(filters, 'businessNature', s)) {
    const bt = s.businessTypes.find((b) => b.id === lot.businessTypeId);
    if (bt) businessNatures.add(bt.businessNature);
  }

  const domainMap = new Map<string, LinkedDomainOption>();
  for (const lot of filterLotsForFacet(filters, 'domainLevelId', s)) {
    if (!lot.domainLevelId) continue;
    const dl = s.domainLevels.find((d) => d.id === lot.domainLevelId);
    const bt = s.businessTypes.find((b) => b.id === lot.businessTypeId);
    if (!dl) continue;
    domainMap.set(dl.id, {
      id: dl.id,
      name: dl.name,
      businessTypeId: dl.businessTypeId,
      label: bt ? `${bt.displayName} / ${dl.name}` : dl.name,
    });
  }

  const procurementMethods = new Set<ProcurementMethod>();
  const evaluationMethods = new Set<EvaluationMethod>();
  for (const lot of filterLotsForFacet(filters, ['procurementMethod', 'evaluationMethod'], s)) {
    lot.procurementMethods.forEach((m) => procurementMethods.add(m));
    lot.evaluationMethods.forEach((m) => evaluationMethods.add(m));
  }

  const sortZh = (a: string, b: string) => a.localeCompare(b, 'zh-CN');

  return {
    energyTypes: [...energyTypes].sort(sortZh),
    businessStages: [...businessStages].sort(sortZh),
    businessNatures: [...businessNatures].sort(sortZh),
    domainLevels: [...domainMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
    procurementMethods: PROCUREMENT_METHODS.filter((m) => procurementMethods.has(m)),
    evaluationMethods: EVALUATION_METHODS.filter((m) => evaluationMethods.has(m)),
  };
}

const PANEL_FILTER_KEYS: FacetKey[] = [
  'businessSectorId',
  'energyType',
  'businessStage',
  'businessNature',
  'domainLevelId',
  'lotName',
  'procurementMethod',
  'evaluationMethod',
];

/** 统计面板区已选条件数（不含树导航） */
export function countActivePanelFilters(filters: LotSearchFilters): number {
  let n = 0;
  for (const k of PANEL_FILTER_KEYS) {
    const v = filters[k];
    if (v === undefined || v === '') continue;
    if (typeof v === 'string' && v.trim()) n += 1;
    else if (v) n += 1;
  }
  return n;
}

/** 更新筛选并清除联动后无效的下级条件 */
export function applyLinkedFilterPatch(
  prev: LotSearchFilters,
  patch: Partial<LotSearchFilters>,
  store: ClassificationStore,
): LotSearchFilters {
  const next: LotSearchFilters = { ...prev, ...patch };
  const linked = getLinkedFilterOptions(next, store);

  if (next.energyType && !linked.energyTypes.includes(next.energyType)) {
    delete next.energyType;
    delete next.businessStage;
    delete next.businessNature;
    delete next.domainLevelId;
  }
  if (next.businessStage && !linked.businessStages.includes(next.businessStage)) {
    delete next.businessStage;
    delete next.businessNature;
    delete next.domainLevelId;
  }
  if (next.businessNature && !linked.businessNatures.includes(next.businessNature)) {
    delete next.businessNature;
    delete next.domainLevelId;
  }
  if (next.domainLevelId && !linked.domainLevels.some((d) => d.id === next.domainLevelId)) {
    delete next.domainLevelId;
  }
  if (next.procurementMethod && !linked.procurementMethods.includes(next.procurementMethod)) {
    delete next.procurementMethod;
  }
  if (next.evaluationMethod && !linked.evaluationMethods.includes(next.evaluationMethod)) {
    delete next.evaluationMethod;
  }

  return next;
}

/** 变更上级维度时级联清空下级 */
export function cascadeClearOnSectorChange(): Partial<LotSearchFilters> {
  return {
    energyType: undefined,
    businessStage: undefined,
    businessNature: undefined,
    domainLevelId: undefined,
  };
}

export function cascadeClearOnEnergyChange(): Partial<LotSearchFilters> {
  return { businessStage: undefined, businessNature: undefined, domainLevelId: undefined };
}

export function cascadeClearOnStageChange(): Partial<LotSearchFilters> {
  return { businessNature: undefined, domainLevelId: undefined };
}

export function cascadeClearOnNatureChange(): Partial<LotSearchFilters> {
  return { domainLevelId: undefined };
}

export function distinctFilterOptions(store?: ClassificationStore) {
  const o = getLinkedFilterOptions({}, store);
  return {
    energyTypes: o.energyTypes,
    businessStages: o.businessStages,
    businessNatures: o.businessNatures,
    domainLevels: o.domainLevels,
  };
}

export { PROCUREMENT_METHOD_LABELS, EVALUATION_METHOD_LABELS };
