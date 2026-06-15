import type { Template, TextFragment } from '@/types';
import { migrateLegacyCategoryId } from './migrate';
import { resolveLotLevelPath } from './resolve';
import { getClassificationStore } from './storage';

/** 解析实体绑定的标段 ID（兼容旧 categoryId） */
export function resolveLotLevelId(
  lotLevelId?: string,
  legacyCategoryId?: string,
): string {
  return (lotLevelId?.trim() || migrateLegacyCategoryId(legacyCategoryId) || '').trim();
}

/** 范本仅有标段展示名、无 lotLevelId 时，按招采分类路径反查叶子标段 ID */
function resolveLotLevelIdFromTemplateNames(
  template: Pick<
    Template,
    'lotLevelName' | 'businessSectorName' | 'businessTypeDisplayName' | 'domainLevelName'
  >,
): string {
  const lotName = template.lotLevelName?.trim();
  if (!lotName) return '';
  const store = getClassificationStore();
  for (const lot of store.lotLevels) {
    if (lot.name !== lotName) continue;
    const path = resolveLotLevelPath(lot.id, store);
    if (!path) continue;
    const sector = template.businessSectorName?.trim();
    const bizType = template.businessTypeDisplayName?.trim();
    const domain = template.domainLevelName?.trim();
    if (sector && path.businessSectorName !== sector) continue;
    if (bizType && path.businessTypeDisplayName !== bizType) continue;
    if (domain && path.domainLevelName !== domain) continue;
    return lot.id;
  }
  return '';
}

export function resolveTemplateLotLevelId(
  template: Pick<
    Template,
    | 'lotLevelId'
    | 'categoryId'
    | 'lotLevelName'
    | 'businessSectorName'
    | 'businessTypeDisplayName'
    | 'domainLevelName'
  >,
): string {
  const direct = resolveLotLevelId(template.lotLevelId, template.categoryId);
  if (direct) return direct;
  return resolveLotLevelIdFromTemplateNames(template);
}

/** 将资源适用范围中的旧品类 ID 迁移为标段 ID */
export function migrateFragmentLotLevelIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => migrateLegacyCategoryId(id)).filter(Boolean))];
}

export function prepareTextFragmentLotScope(input: {
  applicableToAllLotLevels: boolean;
  applicableLotLevelIds: string[];
}): Pick<TextFragment, 'applicableToAllLotLevels' | 'applicableLotLevelIds'> {
  const universal = input.applicableToAllLotLevels;
  return {
    applicableToAllLotLevels: universal,
    applicableLotLevelIds: universal ? [] : migrateFragmentLotLevelIds(input.applicableLotLevelIds),
  };
}
