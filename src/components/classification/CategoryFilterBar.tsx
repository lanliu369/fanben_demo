'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { ClassificationStore } from '@/types';
import { categoryUi } from '@/components/classification/category-ui';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  EVALUATION_METHODS,
  EVALUATION_METHOD_LABELS,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_LABELS,
  type EvaluationMethod,
  type ProcurementMethod,
} from '@/lib/classification/constants';
import {
  applyLinkedFilterPatch,
  cascadeClearOnEnergyChange,
  cascadeClearOnNatureChange,
  cascadeClearOnSectorChange,
  cascadeClearOnStageChange,
  countActivePanelFilters,
  getLinkedFilterOptions,
  type LotSearchFilters,
} from '@/lib/classification/search';

type Props = {
  store: ClassificationStore;
  filters: LotSearchFilters;
  onFiltersChange: (next: LotSearchFilters) => void;
  onResetAll: () => void;
  /** 树形模式下隐藏与左侧树重复的分类维度 */
  treeMode?: boolean;
};

function countDimensionFilters(filters: LotSearchFilters, treeMode: boolean): number {
  let n = 0;
  if (!treeMode && filters.businessSectorId) n += 1;
  if (filters.energyType) n += 1;
  if (filters.businessStage) n += 1;
  if (filters.businessNature) n += 1;
  if (filters.domainLevelId) n += 1;
  if (filters.procurementMethod) n += 1;
  if (filters.evaluationMethod) n += 1;
  return n;
}

function AdvancedFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={categoryUi.advancedFilterField}>
      <span className={categoryUi.advancedFilterLabel}>{label}</span>
      {children}
    </div>
  );
}

export function CategoryFilterBar({
  store,
  filters,
  onFiltersChange,
  onResetAll,
  treeMode = false,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const linked = getLinkedFilterOptions(filters, store);
  const activeCount = countActivePanelFilters(filters);
  const dimensionCount = countDimensionFilters(filters, treeMode);

  const patch = (p: Partial<LotSearchFilters>) => {
    onFiltersChange(applyLinkedFilterPatch(filters, p, store));
  };

  return (
    <div className={categoryUi.filterPanel}>
      <div className={categoryUi.filterRow} style={categoryUi.filterRowStyle}>
        {!treeMode && (
          <>
            <FormSelect
              selectSize="sm"
              value={filters.businessSectorId ?? ''}
              onChange={(e) => {
                const id = e.target.value || undefined;
                onFiltersChange(
                  applyLinkedFilterPatch(
                    filters,
                    { businessSectorId: id, ...cascadeClearOnSectorChange() },
                    store,
                  ),
                );
              }}
              wrapperClassName="shrink-0"
              wrapperStyle={{ width: categoryUi.filterSelectWidths.sector }}
            >
              <option value="">业务板块</option>
              {store.businessSectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </FormSelect>

            <FormSelect
              selectSize="sm"
              value={filters.energyType ?? ''}
              onChange={(e) => {
                const v = e.target.value || undefined;
                onFiltersChange(
                  applyLinkedFilterPatch(
                    filters,
                    { energyType: v, ...cascadeClearOnEnergyChange() },
                    store,
                  ),
                );
              }}
              disabled={linked.energyTypes.length === 0}
              wrapperClassName="shrink-0"
              wrapperStyle={{ width: categoryUi.filterSelectWidths.dimension }}
            >
              <option value="">能源类型</option>
              {linked.energyTypes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </FormSelect>

            <FormSelect
              selectSize="sm"
              value={filters.businessStage ?? ''}
              onChange={(e) => {
                const v = e.target.value || undefined;
                onFiltersChange(
                  applyLinkedFilterPatch(
                    filters,
                    { businessStage: v, ...cascadeClearOnStageChange() },
                    store,
                  ),
                );
              }}
              disabled={linked.businessStages.length === 0}
              wrapperClassName="shrink-0"
              wrapperStyle={{ width: categoryUi.filterSelectWidths.dimension }}
            >
              <option value="">业务阶段</option>
              {linked.businessStages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </FormSelect>
          </>
        )}

        <FormSelect
          selectSize="sm"
          value={filters.procurementMethod ?? ''}
          onChange={(e) =>
            patch({
              procurementMethod: (e.target.value || undefined) as ProcurementMethod | undefined,
            })
          }
          disabled={linked.procurementMethods.length === 0}
          wrapperClassName="shrink-0"
          wrapperStyle={{ width: categoryUi.filterSelectWidths.procurement }}
        >
          <option value="">采购方式</option>
          {linked.procurementMethods.map((m) => (
            <option key={m} value={m}>
              {PROCUREMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </FormSelect>

        <div className="relative min-w-0" style={categoryUi.filterSearchGrow}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="品类名称 / 路径"
            value={filters.lotName ?? ''}
            onChange={(e) => patch({ lotName: e.target.value || undefined })}
            className={categoryUi.searchInput}
          />
        </div>

        <button
          type="button"
          className={`${categoryUi.btnSecondary} shrink-0 ${
            advancedOpen ? 'border-blue-500 bg-blue-50 text-blue-600' : ''
          }`}
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          高级筛选
          {dimensionCount > 0 && (
            <span className="text-xs font-medium">({dimensionCount})</span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {(activeCount > 0 || dimensionCount > 0) && (
          <button
            type="button"
            onClick={onResetAll}
            className={`${categoryUi.btnGhost} shrink-0`}
            title="重置筛选"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
        )}
      </div>

      {advancedOpen && (
        <div className={categoryUi.advancedFilterPanel}>
          <div className={categoryUi.advancedFilterGrid}>
            {!treeMode && (
              <AdvancedFilterField label="业务板块">
                <FormSelect
                  selectSize="sm"
                  value={filters.businessSectorId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    onFiltersChange(
                      applyLinkedFilterPatch(
                        filters,
                        { businessSectorId: id, ...cascadeClearOnSectorChange() },
                        store,
                      ),
                    );
                  }}
                  wrapperClassName="w-full"
                >
                  <option value="">全部</option>
                  {store.businessSectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </FormSelect>
              </AdvancedFilterField>
            )}

            <AdvancedFilterField label="能源类型">
              <FormSelect
                selectSize="sm"
                value={filters.energyType ?? ''}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  onFiltersChange(
                    applyLinkedFilterPatch(
                      filters,
                      { energyType: v, ...cascadeClearOnEnergyChange() },
                      store,
                    ),
                  );
                }}
                disabled={linked.energyTypes.length === 0}
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {linked.energyTypes.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>

            <AdvancedFilterField label="业务阶段">
              <FormSelect
                selectSize="sm"
                value={filters.businessStage ?? ''}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  onFiltersChange(
                    applyLinkedFilterPatch(
                      filters,
                      { businessStage: v, ...cascadeClearOnStageChange() },
                      store,
                    ),
                  );
                }}
                disabled={linked.businessStages.length === 0}
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {linked.businessStages.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>

            <AdvancedFilterField label="业务性质">
              <FormSelect
                selectSize="sm"
                value={filters.businessNature ?? ''}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  onFiltersChange(
                    applyLinkedFilterPatch(
                      filters,
                      { businessNature: v, ...cascadeClearOnNatureChange() },
                      store,
                    ),
                  );
                }}
                disabled={linked.businessNatures.length === 0}
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {linked.businessNatures.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>

            <AdvancedFilterField label="系统/专业/阶段">
              <FormSelect
                selectSize="sm"
                value={filters.domainLevelId ?? ''}
                onChange={(e) => patch({ domainLevelId: e.target.value || undefined })}
                disabled={linked.domainLevels.length === 0}
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {linked.domainLevels.map((dl) => (
                  <option key={dl.id} value={dl.id}>
                    {dl.label}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>

            <AdvancedFilterField label="采购方式">
              <FormSelect
                selectSize="sm"
                value={filters.procurementMethod ?? ''}
                onChange={(e) =>
                  patch({
                    procurementMethod: (e.target.value || undefined) as
                      | ProcurementMethod
                      | undefined,
                  })
                }
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {PROCUREMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PROCUREMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>

            <AdvancedFilterField label="评审办法">
              <FormSelect
                selectSize="sm"
                value={filters.evaluationMethod ?? ''}
                onChange={(e) =>
                  patch({
                    evaluationMethod: (e.target.value || undefined) as
                      | EvaluationMethod
                      | undefined,
                  })
                }
                disabled={linked.evaluationMethods.length === 0}
                wrapperClassName="w-full"
              >
                <option value="">全部</option>
                {linked.evaluationMethods.map((m) => (
                  <option key={m} value={m}>
                    {EVALUATION_METHOD_LABELS[m]}
                  </option>
                ))}
              </FormSelect>
            </AdvancedFilterField>
          </div>
        </div>
      )}
    </div>
  );
}
