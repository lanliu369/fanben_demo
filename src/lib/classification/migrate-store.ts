import type { BusinessSector, BusinessType, ClassificationStore, LotLevel } from '@/types';
import { buildBusinessTypeDisplayName } from './code';
import { defaultClassificationStore, LEGACY_CATEGORY_TO_LOT } from './seed';
import {
  isLegacyClassificationV1Payload,
  type LegacyCategory,
  type LegacyIndustry,
  type LegacyProcurementCategory,
} from './legacy-v1';

const V1_STORAGE_KEYS = ['oo-classification', 'oo-categories'] as const;

function uid(prefix: string) {
  return `${prefix}-mig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString().slice(0, 10);
}

function sectorCodeFromName(name: string): string {
  const map: Record<string, string> = {
    新能源发电: 'XNY',
    传统能源: 'HD',
    通用: 'TY',
  };
  return map[name.trim()] ?? (name.trim().slice(0, 4).toUpperCase() || 'BS');
}

function flattenLegacyIndustries(payload: unknown): LegacyIndustry[] {
  if (!isLegacyClassificationV1Payload(payload)) return [];
  return Array.isArray(payload) ? payload : payload.industries;
}

/**
 * 将旧三级品类树迁移为四级 ClassificationStore（无 DomainLevel 时留空）。
 */
export function migrateLegacyIndustryTreeToStore(payload: unknown): ClassificationStore | null {
  const industries = flattenLegacyIndustries(payload);
  if (industries.length === 0) return null;

  const now = isoNow();
  const store: ClassificationStore = {
    businessSectors: [],
    businessTypes: [],
    domainLevels: [],
    lotLevels: [],
  };

  const sectorByLegacyId = new Map<string, BusinessSector>();
  const btKeyToId = new Map<string, string>();

  for (const ind of industries) {
    let sector = sectorByLegacyId.get(ind.id);
    if (!sector) {
      sector = {
        id: uid('bs'),
        code: ind.code?.trim() || sectorCodeFromName(ind.name),
        name: ind.name.trim(),
        description: ind.description?.trim() || undefined,
        createdAt: ind.createdAt ?? now,
        updatedAt: ind.updatedAt ?? now,
      };
      sectorByLegacyId.set(ind.id, sector);
      store.businessSectors.push(sector);
    }

    for (const pc of ind.procurementCategories ?? []) {
      const energyType = pc.name.trim() || '未分类';
      const businessStage = '默认';
      const businessNature = '默认';
      const btKey = `${sector.id}\u0001${energyType}\u0001${businessStage}\u0001${businessNature}`;
      let businessTypeId = btKeyToId.get(btKey);
      if (!businessTypeId) {
        businessTypeId = uid('bt');
        btKeyToId.set(btKey, businessTypeId);
        const bt: BusinessType = {
          id: businessTypeId,
          businessSectorId: sector.id,
          energyType,
          businessStage,
          businessNature,
          displayName: buildBusinessTypeDisplayName(energyType, businessStage, businessNature),
          description: pc.description?.trim() || undefined,
          createdAt: pc.createdAt ?? now,
          updatedAt: pc.updatedAt ?? now,
        };
        store.businessTypes.push(bt);
      }

      for (const cat of pc.categories ?? []) {
        const lot = legacyCategoryToLot(cat, sector.id, businessTypeId, now);
        store.lotLevels.push(lot);
      }
    }
  }

  return store.lotLevels.length > 0 || store.businessSectors.length > 0 ? store : null;
}

function legacyCategoryToLot(
  cat: LegacyCategory,
  businessSectorId: string,
  businessTypeId: string,
  now: string,
): LotLevel {
  const mappedId = LEGACY_CATEGORY_TO_LOT[cat.id];
  const id = mappedId ?? (cat.id.startsWith('lot-') ? cat.id : uid('lot'));
  return {
    id,
    code: `MIG-${cat.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()}`,
    name: cat.name.trim(),
    businessSectorId,
    businessTypeId,
    domainLevelId: undefined,
    procurementMethods: ['open_tender'],
    evaluationMethods: ['comprehensive_score'],
    createdAt: cat.createdAt ?? now,
    updatedAt: cat.updatedAt ?? now,
  };
}

/** 合并迁移结果与默认种子：按 id 去重，种子数据优先保留演示品类 */
export function mergeMigratedWithDefaultSeed(migrated: ClassificationStore): ClassificationStore {
  const base = JSON.parse(JSON.stringify(defaultClassificationStore)) as ClassificationStore;
  const lotIds = new Set(base.lotLevels.map((l) => l.id));

  for (const lot of migrated.lotLevels) {
    if (!lotIds.has(lot.id)) {
      base.lotLevels.push(lot);
      lotIds.add(lot.id);
    }
  }

  const sectorIds = new Set(base.businessSectors.map((s) => s.id));
  for (const s of migrated.businessSectors) {
    if (!sectorIds.has(s.id)) {
      base.businessSectors.push(s);
      sectorIds.add(s.id);
    }
  }

  const btIds = new Set(base.businessTypes.map((b) => b.id));
  for (const bt of migrated.businessTypes) {
    if (!btIds.has(bt.id)) {
      base.businessTypes.push(bt);
      btIds.add(bt.id);
    }
  }

  const dlIds = new Set(base.domainLevels.map((d) => d.id));
  for (const dl of migrated.domainLevels) {
    if (!dlIds.has(dl.id)) {
      base.domainLevels.push(dl);
      dlIds.add(dl.id);
    }
  }

  return base;
}

export function readAndMigrateLegacyClassificationV1(): ClassificationStore | null {
  if (typeof window === 'undefined') return null;
  for (const key of V1_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateLegacyIndustryTreeToStore(parsed);
      if (migrated) {
        window.localStorage.removeItem(key);
        return mergeMigratedWithDefaultSeed(migrated);
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** 从种子数据补齐缺失的分类说明（不覆盖用户已维护内容） */
function enrichDescriptionsFromSeed(store: ClassificationStore): void {
  for (const s of store.businessSectors) {
    const seed = defaultClassificationStore.businessSectors.find((x) => x.id === s.id);
    if (!s.description?.trim() && seed?.description) {
      s.description = seed.description;
    }
  }
  for (const bt of store.businessTypes) {
    const seed = defaultClassificationStore.businessTypes.find((x) => x.id === bt.id);
    if (!bt.description?.trim() && seed?.description) {
      bt.description = seed.description;
    }
  }
  for (const dl of store.domainLevels) {
    const seed = defaultClassificationStore.domainLevels.find((x) => x.id === dl.id);
    if (!dl.description?.trim() && seed?.description) {
      dl.description = seed.description;
    }
  }
}

/** 校验并补齐 store 引用完整性 */
export function normalizeClassificationStore(store: ClassificationStore): ClassificationStore {
  enrichDescriptionsFromSeed(store);
  const sectorIds = new Set(store.businessSectors.map((s) => s.id));
  const btIds = new Set(store.businessTypes.map((b) => b.id));
  const dlIds = new Set(store.domainLevels.map((d) => d.id));

  const businessTypes = store.businessTypes.filter((bt) => sectorIds.has(bt.businessSectorId));
  const domainLevels = store.domainLevels.filter(
    (dl) => btIds.has(dl.businessTypeId) && sectorIds.size > 0,
  );
  const lotLevels = store.lotLevels
    .filter((lot) => sectorIds.has(lot.businessSectorId) && btIds.has(lot.businessTypeId))
    .map((lot) => {
      const { isActive: _removed, ...rest } = lot as LotLevel & { isActive?: boolean };
      return {
        ...rest,
        domainLevelId:
          rest.domainLevelId && dlIds.has(rest.domainLevelId) ? rest.domainLevelId : undefined,
        procurementMethods: rest.procurementMethods ?? [],
        evaluationMethods: (rest.evaluationMethods ?? []).slice(0, 1),
      };
    });

  return {
    businessSectors: store.businessSectors.map((s) => ({
      ...s,
      sortOrder: s.sortOrder ?? 99,
    })),
    businessTypes: businessTypes.map((b) => ({
      ...b,
      sortOrder: b.sortOrder ?? 99,
    })),
    domainLevels: domainLevels.map((d) => ({
      ...d,
      sortOrder: d.sortOrder ?? 99,
    })),
    lotLevels: lotLevels.map((l) => ({
      ...l,
      sortOrder: l.sortOrder ?? 99,
    })),
  };
}
