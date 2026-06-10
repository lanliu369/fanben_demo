import type { Template, TextFragment } from '@/types';
import { migrateFragmentLotLevelIds } from './lot-id';
import { LEGACY_CATEGORY_TO_LOT } from './seed';
import { resolveLotLevelPath, templateFieldsFromLotPath } from './resolve';

/** 将旧 categoryId 映射为 lotLevelId */
export function migrateLegacyCategoryId(categoryId?: string): string {
  if (!categoryId) return '';
  return LEGACY_CATEGORY_TO_LOT[categoryId] ?? categoryId;
}

export function normalizeTemplateLotFields<T extends Template>(t: T): T {
  const lotLevelId = t.lotLevelId || migrateLegacyCategoryId(t.categoryId);
  if (!lotLevelId) {
    const { categoryId: _c, categoryName: _cn, industryId: _i, industryName: _in, procurementCategoryId: _p, procurementCategoryName: _pn, ...rest } = t;
    return { ...rest, lotLevelId: '' } as T;
  }
  const path = resolveLotLevelPath(lotLevelId);
  if (!path) {
    const { categoryId: _c, categoryName: _cn, industryId: _i, industryName: _in, procurementCategoryId: _p, procurementCategoryName: _pn, ...rest } = t;
    return { ...rest, lotLevelId } as T;
  }
  const {
    categoryId: _c,
    categoryName: _cn,
    industryId: _i,
    industryName: _in,
    procurementCategoryId: _p,
    procurementCategoryName: _pn,
    ...rest
  } = t;
  return { ...rest, ...templateFieldsFromLotPath(path) } as T;
}

export function normalizeTextFragmentLotScope(f: TextFragment): TextFragment {
  const applicableToAllLotLevels =
    f.applicableToAllLotLevels ?? f.applicableToAllCategories ?? true;
  const rawIds = f.applicableLotLevelIds ?? f.applicableCategoryIds ?? [];
  const applicableLotLevelIds = applicableToAllLotLevels
    ? []
    : migrateFragmentLotLevelIds(rawIds);
  const {
    applicableToAllCategories: _a,
    applicableCategoryIds: _b,
    ...rest
  } = f;
  return {
    ...rest,
    applicableToAllLotLevels,
    applicableLotLevelIds,
  };
}
