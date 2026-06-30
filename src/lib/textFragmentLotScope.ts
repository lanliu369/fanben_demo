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
  const primaryId = ids[0];
  if (!primaryId) return false;
  if (primaryId === resolvedTpl) return true;

  const store = getClassificationStore();
  const tplPath = resolveLotLevelPath(resolvedTpl, store);
  if (!tplPath) return false;
  const fragPath = resolveLotLevelPath(primaryId, store);
  return Boolean(fragPath && fragPath.lotLevelName === tplPath.lotLevelName);
}

/**
 * 资源「适用品类」：每个资源仅对一个品类级别生效；在对应品类关联的范本侧栏中展示。
 * - 历史「通用」数据（applicableToAllLotLevels !== false）仍对全部品类匹配，保存后收敛为单品类。
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

/** 按范本招采分类（品类）判断资源是否可在侧栏展示 */
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
