'use client';

import { useMemo } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { ClassificationStore } from '@/types';
import type {
  TemplateCategoryFilter,
  TemplateListAiMatchGroup,
  TemplateTimeFilter,
} from '@/lib/templateListQuery';
import { buildCategoryFilterBreadcrumb } from '@/lib/templateListQuery';

type CategoryFilterPanelProps = {
  store: ClassificationStore;
  value: TemplateCategoryFilter;
  onChange: (value: TemplateCategoryFilter) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function TemplateCategoryFilterPanel({
  store,
  value,
  onChange,
  collapsed,
  onCollapsedChange,
}: CategoryFilterPanelProps) {
  const filterBusinessTypes = store.businessTypes.filter(
    (bt) => bt.businessSectorId === value.businessSectorId,
  );
  const filterLots = store.lotLevels.filter((l) => {
    if (value.businessTypeId && l.businessTypeId !== value.businessTypeId) return false;
    if (value.businessSectorId && l.businessSectorId !== value.businessSectorId) return false;
    return true;
  });
  const breadcrumb = buildCategoryFilterBreadcrumb(store, value);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          品类筛选
          {breadcrumb.length > 0 && (
            <span className="text-xs text-blue-600 font-normal">{breadcrumb.join(' › ')}</span>
          )}
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">业务板块</div>
              <div className="max-h-44 overflow-y-auto">
                {store.businessSectors.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const on = value.businessSectorId === s.id;
                      onChange({
                        businessSectorId: on ? '' : s.id,
                        businessTypeId: '',
                        lotLevelId: '',
                      });
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                      value.businessSectorId === s.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {s.name}
                    {value.businessSectorId === s.id && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">能源/业务类型</div>
              <div className="max-h-44 overflow-y-auto">
                {!value.businessSectorId ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">请先选择业务板块</div>
                ) : (
                  filterBusinessTypes.map((bt) => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => {
                        const on = value.businessTypeId === bt.id;
                        onChange({
                          ...value,
                          businessTypeId: on ? '' : bt.id,
                          lotLevelId: '',
                        });
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                        value.businessTypeId === bt.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {bt.displayName}
                      {value.businessTypeId === bt.id && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">品类级别</div>
              <div className="max-h-44 overflow-y-auto">
                {!value.businessTypeId ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">请先选择业务类型</div>
                ) : (
                  filterLots.map((lot) => (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          lotLevelId: value.lotLevelId === lot.id ? '' : lot.id,
                        })
                      }
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                        value.lotLevelId === lot.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{lot.name}</span>
                      {value.lotLevelId === lot.id && (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type UpdatedTimeFilterPanelProps = {
  value: TemplateTimeFilter;
  onChange: (value: TemplateTimeFilter) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  hint?: string;
};

export function TemplateUpdatedTimeFilterPanel({
  value,
  onChange,
  collapsed,
  onCollapsedChange,
  hint = '按更新时间进行区间过滤（包含起止日期）',
}: UpdatedTimeFilterPanelProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          更新时间查询
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>
      {!collapsed && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">按更新时间筛选</div>
            {(value.startDate || value.endDate) && (
              <button
                type="button"
                onClick={() => onChange({ startDate: '', endDate: '' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                清空条件
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-xs text-slate-500">开始日期</span>
              <input
                type="date"
                value={value.startDate}
                onChange={(e) => onChange({ ...value, startDate: e.target.value })}
                className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <span className="text-slate-400 text-sm">至</span>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-xs text-slate-500">结束日期</span>
              <input
                type="date"
                value={value.endDate}
                onChange={(e) => onChange({ ...value, endDate: e.target.value })}
                className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">{hint}</div>
        </div>
      )}
    </div>
  );
}

type AiSearchPanelProps = {
  placeholder: string;
  itemLabel: string;
  query: string;
  searching: boolean;
  matchGroups: TemplateListAiMatchGroup[] | null;
  matchedCount: number;
  selectedLotLevelId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onApplyGroup: (group: TemplateListAiMatchGroup) => void;
};

export function TemplateAiSearchPanel({
  placeholder,
  itemLabel,
  query,
  searching,
  matchGroups,
  matchedCount,
  selectedLotLevelId,
  onQueryChange,
  onSearch,
  onClear,
  onApplyGroup,
}: AiSearchPanelProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="relative">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            if (!e.target.value) onClear();
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="w-full pl-10 pr-28 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {searching && (
          <Loader2 className="absolute right-20 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
        )}
        {query && !searching && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          AI 搜索
        </button>
      </div>
      {matchGroups !== null && matchGroups.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                AI 推荐
              </span>
              <span className="text-xs text-slate-500">
                匹配到 <b className="text-slate-700">{matchGroups.length}</b> 个品类 ·{' '}
                <b className="text-slate-700">{matchedCount}</b> 个{itemLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> 清除
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {matchGroups.map((group) => (
              <button
                key={group.lotLevelId || group.lotLevelName}
                type="button"
                onClick={() => onApplyGroup(group)}
                className={`group text-left relative border rounded-lg px-3 py-2.5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  selectedLotLevelId === group.lotLevelId
                    ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-300'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
                style={{ minWidth: 200, maxWidth: 280 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                      {group.lotLevelName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {group.businessSectorName} › {group.businessTypeDisplayName}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {group.itemCount} 个
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {group.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                {selectedLotLevelId === group.lotLevelId && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">点击卡片可快速定位到对应品类筛选</p>
        </div>
      )}
    </div>
  );
}

type ActiveFilterTagsProps = {
  store: ClassificationStore;
  categoryFilter: TemplateCategoryFilter;
  timeFilter: TemplateTimeFilter;
  onClearCategory: () => void;
};

export function TemplateListActiveFilterTags({
  store,
  categoryFilter,
  timeFilter,
  onClearCategory,
}: ActiveFilterTagsProps) {
  const breadcrumb = useMemo(
    () => buildCategoryFilterBreadcrumb(store, categoryFilter),
    [store, categoryFilter],
  );

  if (breadcrumb.length === 0 && !timeFilter.startDate && !timeFilter.endDate) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1.5">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300 text-xs">›</span>}
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{crumb}</span>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearCategory}
            className="ml-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {(timeFilter.startDate || timeFilter.endDate) && (
        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
          时间：{timeFilter.startDate || '不限'} ~ {timeFilter.endDate || '不限'}
        </span>
      )}
    </div>
  );
}
