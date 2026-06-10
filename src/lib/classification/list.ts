import type { ClassificationStore, LotLevel } from '@/types';
import type { EvaluationMethod, ProcurementMethod } from './constants';
import { formatLotBusinessPath, resolveLotLevelPath } from './resolve';

/** 标段列表行视图（与 UI 解耦，便于列表/导出复用） */
export type LotTableRow = {
  lot: LotLevel;
  businessPath: string;
  businessPathTitle?: string;
  procurementMethods: ProcurementMethod[];
  evaluationMethods: EvaluationMethod[];
  /** 列表搜索关键词（用于高亮） */
  searchQuery?: string;
};

export function toLotTableRows(
  lots: LotLevel[],
  store: ClassificationStore,
  searchQuery?: string,
): LotTableRow[] {
  const q = searchQuery?.trim() || undefined;
  return lots.map((lot) => {
    const path = resolveLotLevelPath(lot.id, store);
    const businessPath = path ? formatLotBusinessPath(path) : '—';
    return {
      lot,
      businessPath,
      businessPathTitle: path ? businessPath : undefined,
      procurementMethods: lot.procurementMethods,
      evaluationMethods: lot.evaluationMethods,
      searchQuery: q,
    };
  });
}
