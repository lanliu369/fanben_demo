import type { TextFragment } from '@/types';
import { migrateLegacyCategoryId } from '@/lib/classification/migrate';

/**
 * 资源「适用标段范围」：在关联了某标段叶子节点的范本内，是否允许在侧栏展示该资源。
 */
export function textFragmentAppliesToTemplateLot(
  frag: TextFragment,
  templateLotLevelId: string | undefined,
): boolean {
  if (!templateLotLevelId) return true;
  const universal = frag.applicableToAllLotLevels ?? frag.applicableToAllCategories ?? true;
  if (universal !== false) return true;
  const resolvedTpl = migrateLegacyCategoryId(templateLotLevelId);
  const ids = (frag.applicableLotLevelIds ?? frag.applicableCategoryIds ?? []).map((id) =>
    migrateLegacyCategoryId(id),
  );
  return ids.length > 0 && ids.includes(resolvedTpl);
}

/** @deprecated */
export { textFragmentAppliesToTemplateLot as textFragmentAppliesToTemplateCategory };
