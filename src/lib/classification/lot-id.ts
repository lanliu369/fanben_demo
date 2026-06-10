import type { Template, TextFragment } from '@/types';
import { migrateLegacyCategoryId } from './migrate';

/** 解析实体绑定的标段 ID（兼容旧 categoryId） */
export function resolveLotLevelId(
  lotLevelId?: string,
  legacyCategoryId?: string,
): string {
  return (lotLevelId?.trim() || migrateLegacyCategoryId(legacyCategoryId) || '').trim();
}

export function resolveTemplateLotLevelId(
  template: Pick<Template, 'lotLevelId' | 'categoryId'>,
): string {
  return resolveLotLevelId(template.lotLevelId, template.categoryId);
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
