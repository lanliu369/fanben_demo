import type {
  BusinessSector,
  BusinessType,
  ClassificationStore,
  DomainLevel,
  LotLevel,
} from '@/types';
import type { EvaluationMethod, ProcurementMethod } from './constants';
import {
  buildBusinessTypeDisplayName,
  buildUniquenessKey,
  generateLotCode,
  lotUniquenessKeyFromEntities,
} from './code';
import { getClassificationStore, setClassificationStore } from './storage';

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString().slice(0, 10);
}

function applyNodeDescription<T extends { description?: string; updatedAt: string }>(
  entity: T,
  description?: string,
): T {
  const trimmed = description?.trim();
  if (trimmed) {
    entity.description = trimmed;
    entity.updatedAt = isoNow();
  }
  return entity;
}

function sectorCodeFromName(name: string): string {
  const map: Record<string, string> = {
    新能源发电: 'XNY',
    传统能源: 'HD',
    通用: 'TY',
    风电: 'FD',
  };
  return map[name.trim()] ?? (name.trim().slice(0, 4).toUpperCase() || 'BS');
}

export function findOrCreateBusinessSector(
  store: ClassificationStore,
  sectorName: string,
  description?: string,
): BusinessSector | null {
  const name = sectorName.trim();
  if (!name) return null;
  const existing = store.businessSectors.find((s) => s.name === name);
  if (existing) {
    return applyNodeDescription(existing, description);
  }
  const now = isoNow();
  const created: BusinessSector = {
    id: uid('bs'),
    code: sectorCodeFromName(name),
    name,
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  store.businessSectors.push(created);
  return created;
}

export type LotFormInput = {
  businessSectorId: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelId?: string;
  domainLevelNameNew?: string;
  lotName: string;
  procurementMethods: ProcurementMethod[];
  evaluationMethods: EvaluationMethod[];
  /** 一级分类说明（字典元数据） */
  sectorDescription?: string;
  /** 二级分类说明（字典元数据） */
  businessTypeDescription?: string;
  /** 三级分类说明（字典元数据） */
  domainLevelDescription?: string;
};

export function findOrCreateBusinessType(
  store: ClassificationStore,
  input: {
    businessSectorId: string;
    energyType: string;
    businessStage: string;
    businessNature: string;
    description?: string;
  },
): BusinessType {
  const displayName = buildBusinessTypeDisplayName(
    input.energyType,
    input.businessStage,
    input.businessNature,
  );
  const existing = store.businessTypes.find(
    (bt) =>
      bt.businessSectorId === input.businessSectorId &&
      bt.energyType === input.energyType.trim() &&
      bt.businessStage === input.businessStage.trim() &&
      bt.businessNature === input.businessNature.trim(),
  );
  if (existing) {
    return applyNodeDescription(existing, input.description);
  }
  const now = isoNow();
  const created: BusinessType = {
    id: uid('bt'),
    businessSectorId: input.businessSectorId,
    energyType: input.energyType.trim(),
    businessStage: input.businessStage.trim(),
    businessNature: input.businessNature.trim(),
    displayName,
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  store.businessTypes.push(created);
  return created;
}

export function findOrCreateDomainLevel(
  store: ClassificationStore,
  input: {
    businessTypeId: string;
    domainLevelId?: string;
    domainLevelNameNew?: string;
    description?: string;
  },
): DomainLevel | undefined {
  if (input.domainLevelId) {
    const found = store.domainLevels.find((d) => d.id === input.domainLevelId);
    if (found) return applyNodeDescription(found, input.description);
    return undefined;
  }
  const name = input.domainLevelNameNew?.trim();
  if (!name) return undefined;
  const existing = store.domainLevels.find(
    (d) => d.businessTypeId === input.businessTypeId && d.name === name,
  );
  if (existing) {
    return applyNodeDescription(existing, input.description);
  }
  const now = isoNow();
  const created: DomainLevel = {
    id: uid('dl'),
    name,
    businessTypeId: input.businessTypeId,
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  store.domainLevels.push(created);
  return created;
}

export function checkLotDuplicate(
  store: ClassificationStore,
  input: LotFormInput,
  excludeLotId?: string,
): boolean {
  const sector = store.businessSectors.find((s) => s.id === input.businessSectorId);
  if (!sector) return false;
  const domainName =
    input.domainLevelId != null
      ? store.domainLevels.find((d) => d.id === input.domainLevelId)?.name ?? ''
      : (input.domainLevelNameNew?.trim() ?? '');
  const key = buildUniquenessKey({
    businessSectorName: sector.name,
    energyType: input.energyType.trim(),
    businessStage: input.businessStage.trim(),
    businessNature: input.businessNature.trim(),
    domainLevelName: domainName,
    lotName: input.lotName,
  });
  return store.lotLevels.some((lot) => {
    if (excludeLotId && lot.id === excludeLotId) return false;
    const s = store.businessSectors.find((x) => x.id === lot.businessSectorId);
    const t = store.businessTypes.find((x) => x.id === lot.businessTypeId);
    const d = lot.domainLevelId
      ? store.domainLevels.find((x) => x.id === lot.domainLevelId)
      : undefined;
    if (!s || !t) return false;
    return lotUniquenessKeyFromEntities(s.name, t, d?.name ?? '', lot) === key;
  });
}

function validateLotFormInput(input: LotFormInput): string | null {
  if (!input.energyType?.trim()) return '请填写能源类型';
  if (!input.businessStage?.trim()) return '请填写业务阶段';
  if (!input.businessNature?.trim()) return '请填写业务性质';
  if (!input.lotName?.trim()) return '请填写标段级别';
  if (!input.procurementMethods?.length) return '请至少选择一种采购方式';
  if (!input.evaluationMethods?.length) return '请选择评审办法';
  return null;
}

export function createLotLevel(input: LotFormInput): { lot: LotLevel; error?: string } {
  const validationError = validateLotFormInput(input);
  if (validationError) return { lot: {} as LotLevel, error: validationError };
  const store = getClassificationStore();
  if (checkLotDuplicate(store, input)) {
    return { lot: {} as LotLevel, error: '已存在相同业务路径的标段，请勿重复创建' };
  }
  const sector = store.businessSectors.find((s) => s.id === input.businessSectorId);
  if (!sector) return { lot: {} as LotLevel, error: '业务板块不存在' };
  applyNodeDescription(sector, input.sectorDescription);
  const bt = findOrCreateBusinessType(store, {
    businessSectorId: input.businessSectorId,
    energyType: input.energyType,
    businessStage: input.businessStage,
    businessNature: input.businessNature,
    description: input.businessTypeDescription,
  });
  const domain = findOrCreateDomainLevel(store, {
    businessTypeId: bt.id,
    domainLevelId: input.domainLevelId,
    domainLevelNameNew: input.domainLevelNameNew,
    description: input.domainLevelDescription,
  });
  const now = isoNow();
  const code = generateLotCode({
    sector,
    businessType: bt,
    domainLevel: domain,
    lotName: input.lotName,
  });
  const lot: LotLevel = {
    id: uid('lot'),
    code,
    name: input.lotName.trim(),
    businessSectorId: sector.id,
    businessTypeId: bt.id,
    domainLevelId: domain?.id,
    procurementMethods: [...input.procurementMethods],
    evaluationMethods: input.evaluationMethods.slice(0, 1),
    createdAt: now,
    updatedAt: now,
  };
  store.lotLevels.push(lot);
  setClassificationStore(store);
  return { lot };
}

export function updateLotLevel(
  lotId: string,
  input: LotFormInput,
): { lot: LotLevel; error?: string } {
  const validationError = validateLotFormInput(input);
  if (validationError) return { lot: {} as LotLevel, error: validationError };
  const store = getClassificationStore();
  const idx = store.lotLevels.findIndex((l) => l.id === lotId);
  if (idx < 0) return { lot: {} as LotLevel, error: '标段不存在' };
  if (checkLotDuplicate(store, input, lotId)) {
    return { lot: {} as LotLevel, error: '已存在相同业务路径的标段' };
  }
  const sector = store.businessSectors.find((s) => s.id === input.businessSectorId);
  if (!sector) return { lot: {} as LotLevel, error: '业务板块不存在' };
  applyNodeDescription(sector, input.sectorDescription);
  const bt = findOrCreateBusinessType(store, {
    businessSectorId: input.businessSectorId,
    energyType: input.energyType,
    businessStage: input.businessStage,
    businessNature: input.businessNature,
    description: input.businessTypeDescription,
  });
  const domain = findOrCreateDomainLevel(store, {
    businessTypeId: bt.id,
    domainLevelId: input.domainLevelId,
    domainLevelNameNew: input.domainLevelNameNew,
    description: input.domainLevelDescription,
  });
  const prev = store.lotLevels[idx];
  const code = generateLotCode({
    sector,
    businessType: bt,
    domainLevel: domain,
    lotName: input.lotName,
  });
  const updated: LotLevel = {
    ...prev,
    code,
    name: input.lotName.trim(),
    businessSectorId: sector.id,
    businessTypeId: bt.id,
    domainLevelId: domain?.id,
    procurementMethods: [...input.procurementMethods],
    evaluationMethods: input.evaluationMethods.slice(0, 1),
    updatedAt: isoNow(),
  };
  store.lotLevels[idx] = updated;
  setClassificationStore(store);
  return { lot: updated };
}

export function deleteLotLevel(lotId: string): boolean {
  const store = getClassificationStore();
  const next = store.lotLevels.filter((l) => l.id !== lotId);
  if (next.length === store.lotLevels.length) return false;
  setClassificationStore({ ...store, lotLevels: next });
  return true;
}

export type NodeDescriptionTarget =
  | { kind: 'sector'; id: string }
  | { kind: 'businessType'; id: string }
  | { kind: 'domain'; id: string };

/** 更新分类节点说明（字典元数据，不影响标段业务字段） */
export function patchClassificationNodeDescription(
  target: NodeDescriptionTarget,
  description: string,
): boolean {
  const store = getClassificationStore();
  const trimmed = description.trim();
  const now = isoNow();

  if (target.kind === 'sector') {
    const idx = store.businessSectors.findIndex((s) => s.id === target.id);
    if (idx < 0) return false;
    const next = [...store.businessSectors];
    next[idx] = {
      ...next[idx],
      description: trimmed || undefined,
      updatedAt: now,
    };
    setClassificationStore({ ...store, businessSectors: next });
    return true;
  }

  if (target.kind === 'businessType') {
    const idx = store.businessTypes.findIndex((b) => b.id === target.id);
    if (idx < 0) return false;
    const next = [...store.businessTypes];
    next[idx] = {
      ...next[idx],
      description: trimmed || undefined,
      updatedAt: now,
    };
    setClassificationStore({ ...store, businessTypes: next });
    return true;
  }

  const idx = store.domainLevels.findIndex((d) => d.id === target.id);
  if (idx < 0) return false;
  const next = [...store.domainLevels];
  next[idx] = {
    ...next[idx],
    description: trimmed || undefined,
    updatedAt: now,
  };
  setClassificationStore({ ...store, domainLevels: next });
  return true;
}

export function getClassificationStats(store?: ClassificationStore) {
  const s = store ?? getClassificationStore();
  const procurementSet = new Set<string>();
  const evaluationSet = new Set<string>();
  s.lotLevels.forEach((lot) => {
    lot.procurementMethods.forEach((m) => procurementSet.add(m));
    lot.evaluationMethods.forEach((m) => evaluationSet.add(m));
  });
  return {
    businessSectorCount: s.businessSectors.length,
    businessTypeCount: s.businessTypes.length,
    domainLevelCount: s.domainLevels.length,
    lotLevelCount: s.lotLevels.length,
    procurementCoverageCount: procurementSet.size,
    evaluationCoverageCount: evaluationSet.size,
  };
}
