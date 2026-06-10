import type { Template } from '@/types';
import { formatLotBusinessPath } from '@/lib/classification/resolve';
import { getLotLevelPath } from '@/lib/mockData';

/** 范本所属招采分类完整路径（四级） */
export function formatTemplateClassification(template: Template): string {
  if (template.lotLevelId) {
    const path = getLotLevelPath(template.lotLevelId);
    if (path) return formatLotBusinessPath(path);
  }
  const parts = [
    template.businessSectorName,
    template.businessTypeDisplayName,
    template.domainLevelName,
    template.lotLevelName,
  ].filter((p): p is string => Boolean(p?.trim()));
  return parts.length > 0 ? parts.join(' / ') : '—';
}
