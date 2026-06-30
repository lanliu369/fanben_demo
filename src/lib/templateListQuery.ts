import type { ClassificationStore, GeneralTemplate, Template } from '@/types';
import { resolveLotLevelPath } from '@/lib/classification/resolve';

export type TemplateCategoryFilter = {
  businessSectorId: string;
  businessTypeId: string;
  lotLevelId: string;
};

export function emptyTemplateCategoryFilter(): TemplateCategoryFilter {
  return { businessSectorId: '', businessTypeId: '', lotLevelId: '' };
}

export type TemplateTimeFilter = {
  startDate: string;
  endDate: string;
};

export function emptyTemplateTimeFilter(): TemplateTimeFilter {
  return { startDate: '', endDate: '' };
}

export type TemplateListAiMatchGroup = {
  lotLevelId: string;
  lotLevelName: string;
  businessTypeDisplayName: string;
  businessSectorName: string;
  businessSectorId: string;
  businessTypeId: string;
  itemCount: number;
  keywords: string[];
};

export function buildCategoryFilterBreadcrumb(
  store: ClassificationStore,
  filter: TemplateCategoryFilter,
): string[] {
  return [
    filter.businessSectorId
      && store.businessSectors.find((s) => s.id === filter.businessSectorId)?.name,
    filter.businessTypeId
      && store.businessTypes.find((bt) => bt.id === filter.businessTypeId)?.displayName,
    filter.lotLevelId
      && store.lotLevels.find((l) => l.id === filter.lotLevelId)?.name,
  ].filter(Boolean) as string[];
}

export function itemMatchesCategoryFilter(
  lotLevelIds: string[],
  store: ClassificationStore,
  filter: TemplateCategoryFilter,
): boolean {
  if (!filter.businessSectorId && !filter.businessTypeId && !filter.lotLevelId) return true;
  if (lotLevelIds.length === 0) return false;

  return lotLevelIds.some((lotId) => {
    const lot = store.lotLevels.find((l) => l.id === lotId);
    if (!lot) return false;
    if (filter.lotLevelId) return lotId === filter.lotLevelId;
    if (filter.businessTypeId) return lot.businessTypeId === filter.businessTypeId;
    if (filter.businessSectorId) return lot.businessSectorId === filter.businessSectorId;
    return true;
  });
}

export function itemMatchesTimeFilter(updatedAt: string, filter: TemplateTimeFilter): boolean {
  if (filter.startDate && updatedAt.slice(0, 10) < filter.startDate) return false;
  if (filter.endDate && updatedAt.slice(0, 10) > filter.endDate) return false;
  return true;
}

export function scoreTemplateQuery(query: string, haystackParts: (string | undefined)[]): number {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const haystack = haystackParts.filter(Boolean).join(' ').toLowerCase();
  return tokens.reduce((n, tok) => n + (haystack.includes(tok) ? 1 : 0), 0);
}

export function scoreTemplateItem(query: string, template: Template): number {
  return scoreTemplateQuery(query, [
    template.name,
    template.lotLevelName,
    template.businessSectorName,
    template.businessTypeDisplayName,
    template.energyType,
    template.description,
    ...template.sections.map((s) => s.title),
  ]);
}

export function scoreGeneralTemplateItem(
  query: string,
  item: GeneralTemplate,
  store: ClassificationStore,
): number {
  const pathTexts = item.lotLevelIds.flatMap((id) => {
    const path = resolveLotLevelPath(id, store);
    if (!path) return [];
    return [
      path.lotLevelName,
      path.businessSectorName,
      path.businessTypeDisplayName,
      path.energyType,
      path.businessStage,
    ];
  });
  return scoreTemplateQuery(query, [
    item.name,
    item.description,
    item.originalFileName,
    ...pathTexts,
  ]);
}

type LotGroupMeta = {
  lotLevelId: string;
  lotLevelName: string;
  businessSectorId: string;
  businessSectorName: string;
  businessTypeId: string;
  businessTypeDisplayName: string;
};

export function buildAiMatchGroups<T extends { id: string }>(
  matchedItems: T[],
  getLotMeta: (item: T) => LotGroupMeta | null,
  queryTokens: string[],
): TemplateListAiMatchGroup[] {
  const groupMap = new Map<string, TemplateListAiMatchGroup & { items: T[] }>();

  for (const item of matchedItems) {
    const meta = getLotMeta(item);
    const key = meta?.lotLevelId || 'uncategorized';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        lotLevelId: meta?.lotLevelId ?? '',
        lotLevelName: meta?.lotLevelName ?? '未分类',
        businessSectorName: meta?.businessSectorName ?? '',
        businessSectorId: meta?.businessSectorId ?? '',
        businessTypeId: meta?.businessTypeId ?? '',
        businessTypeDisplayName: meta?.businessTypeDisplayName ?? '',
        itemCount: 0,
        keywords: [],
        items: [],
      });
    }
    groupMap.get(key)!.items.push(item);
  }

  return Array.from(groupMap.values())
    .map(({ items, ...group }) => {
      const text = items
        .map((item) => {
          const meta = getLotMeta(item);
          return [meta?.lotLevelName, (item as { name?: string }).name].join(' ');
        })
        .join(' ')
        .toLowerCase();
      const keywords = queryTokens.filter((tok) => text.includes(tok)).slice(0, 4);
      return {
        ...group,
        itemCount: items.length,
        keywords: keywords.length > 0 ? keywords : queryTokens.slice(0, 3),
      };
    })
    .sort((a, b) => b.itemCount - a.itemCount);
}

export function lotMetaFromTemplate(template: Template): LotGroupMeta | null {
  if (!template.lotLevelId) return null;
  return {
    lotLevelId: template.lotLevelId,
    lotLevelName: template.lotLevelName || '未分类',
    businessSectorId: template.businessSectorId || '',
    businessSectorName: template.businessSectorName || '',
    businessTypeId: template.businessTypeId || '',
    businessTypeDisplayName: template.businessTypeDisplayName || '',
  };
}

export function lotMetaFromGeneralTemplate(
  item: GeneralTemplate,
  store: ClassificationStore,
): LotGroupMeta | null {
  const lotId = item.lotLevelIds[0];
  if (!lotId) return null;
  const path = resolveLotLevelPath(lotId, store);
  if (!path) return null;
  return {
    lotLevelId: path.lotLevelId,
    lotLevelName: path.lotLevelName,
    businessSectorId: path.businessSectorId,
    businessSectorName: path.businessSectorName,
    businessTypeId: path.businessTypeId,
    businessTypeDisplayName: path.businessTypeDisplayName,
  };
}
