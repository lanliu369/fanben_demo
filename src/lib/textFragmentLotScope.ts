import type { Template, TextFragment } from '@/types';
import { resolveTemplateLotLevelId } from '@/lib/classification/lot-id';
import { resolveLotLevelPath } from '@/lib/classification/resolve';
import { getClassificationStore } from '@/lib/classification/storage';
import { migrateLegacyCategoryId } from '@/lib/classification/migrate';

function fragmentLotIdsMatchTemplateLot(frag: TextFragment, templateLotLevelId: string): boolean {
  const resolvedTpl = migrateLegacyCategoryId(templateLotLevelId);
  const ids = (frag.applicableLotLevelIds ?? frag.applicableCategoryIds ?? []).map((id) =>
    migrateLegacyCategoryId(id),
  );
  if (ids.length === 0) return false;
  if (ids.includes(resolvedTpl)) return true;

  const store = getClassificationStore();
  const tplPath = resolveLotLevelPath(resolvedTpl, store);
  if (!tplPath) return false;
  return ids.some((id) => {
    const fragPath = resolveLotLevelPath(id, store);
    return Boolean(fragPath && fragPath.lotLevelName === tplPath.lotLevelName);
  });
}

/**
 * 资源「适用标段范围」：在关联了某标段叶子节点的范本内，是否允许在侧栏展示该资源。
 * - 通用（applicableToAllLotLevels !== false）：任意范本标段均匹配。
 * - 指定范围：仅当资源所选标段与范本标段 ID（或标段名称）一致时匹配。
 */
export function textFragmentAppliesToTemplateLot(
  frag: TextFragment,
  templateLotLevelId: string | undefined,
): boolean {
  const universal = frag.applicableToAllLotLevels ?? frag.applicableToAllCategories ?? true;
  if (universal !== false) return true;
  if (!templateLotLevelId) return false;
  return fragmentLotIdsMatchTemplateLot(frag, templateLotLevelId);
}

/** 按范本招采分类（标段）判断资源是否可在侧栏展示 */
export function textFragmentAppliesToTemplate(
  frag: TextFragment,
  template: Pick<
    Template,
    | 'lotLevelId'
    | 'categoryId'
    | 'lotLevelName'
    | 'businessSectorName'
    | 'businessTypeDisplayName'
    | 'domainLevelName'
  >,
): boolean {
  return textFragmentAppliesToTemplateLot(frag, resolveTemplateLotLevelId(template));
}

/** @deprecated */
export { textFragmentAppliesToTemplateLot as textFragmentAppliesToTemplateCategory };
