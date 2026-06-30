'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import type { ClassificationStore } from '@/types';
import {
  EVALUATION_METHODS,
  EVALUATION_METHOD_LABELS,
  EXPORT_HEADERS,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_LABELS,
  type EvaluationMethod,
  type ProcurementMethod,
} from '@/lib/classification/constants';
import {
  exportLotsToFile,
  getLotsForExport,
  type ExportFilters,
  type ExportScope,
} from '@/lib/classification/import-export';
import {
  applyLinkedFilterPatch,
  countActivePanelFilters,
  getLinkedFilterOptions,
} from '@/lib/classification/search';
import { getClassificationStore } from '@/lib/classification/storage';
import { FormSelect } from '@/components/ui/FormSelect';

type Props = {
  open: boolean;
  onClose: () => void;
  onExported: (detail: string) => void;
  /** 品类页当前列表筛选（含树导航） */
  currentListFilters?: ExportFilters;
  store?: ClassificationStore;
};

export function ExportLotsDialog({
  open,
  onClose,
  onExported,
  currentListFilters,
  store: storeProp,
}: Props) {
  const store = useMemo(() => storeProp ?? getClassificationStore(), [storeProp, open]);
  const [customFilters, setCustomFilters] = useState<ExportFilters>({});
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scope, setScope] = useState<ExportScope>('current');

  const hasCurrentScope = Boolean(
    currentListFilters &&
      (countActivePanelFilters(currentListFilters) > 0 ||
        currentListFilters.businessTypeId ||
        currentListFilters.navDomainLevelId),
  );

  useEffect(() => {
    if (!open) return;
    setScope(hasCurrentScope ? 'current' : 'all');
    setCustomFilters({});
    setFormat('xlsx');
  }, [open, hasCurrentScope]);

  if (!open) return null;

  const previewCount = getLotsForExport(scope, store, {
    customFilters: customFilters,
    currentFilters: currentListFilters,
  }).length;

  const linked =
    scope === 'custom'
      ? getLinkedFilterOptions(customFilters, store)
      : scope === 'current' && currentListFilters
        ? getLinkedFilterOptions(currentListFilters, store)
        : getLinkedFilterOptions({}, store);

  const currentPanelActive = currentListFilters ? countActivePanelFilters(currentListFilters) : 0;
  const currentScopeHint =
    currentListFilters?.businessTypeId || currentListFilters?.navDomainLevelId
      ? '含树导航'
      : '';

  const handleExport = () => {
    if (previewCount === 0) return;
    const { detail } = exportLotsToFile(scope, format, store, {
      customFilters,
      currentFilters: currentListFilters,
    });
    onExported(detail);
    onClose();
  };

  const patchCustom = (p: Partial<ExportFilters>) => {
    setCustomFilters((prev) => applyLinkedFilterPatch(prev, p, store));
  };

  return (
    <ModalOverlay>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">导出品类</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              支持 Excel / CSV；字段含业务板块、能源类型、阶段、性质、专业域、品类、规则与更新时间
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">导出范围</p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/40">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-slate-800">全量导出</span>
                  <span className="block text-xs text-slate-500 mt-0.5">导出全部品类（{store.lotLevels.length} 条）</span>
                </span>
              </label>
              <label
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/40 ${
                  hasCurrentScope
                    ? 'cursor-pointer hover:bg-slate-50 border-slate-200'
                    : 'opacity-50 cursor-not-allowed border-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'current'}
                  onChange={() => setScope('current')}
                  disabled={!hasCurrentScope}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-slate-800">按当前列表条件</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    与品类页筛选区 + 左侧树导航一致
                    {currentPanelActive > 0 ? `（${currentPanelActive} 项面板条件` : ''}
                    {currentScopeHint ? `${currentPanelActive > 0 ? '，' : '（'}${currentScopeHint}` : ''}
                    {(currentPanelActive > 0 || currentScopeHint) ? '）' : ''}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/40">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'custom'}
                  onChange={() => setScope('custom')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-slate-800">自定义条件</span>
                  <span className="block text-xs text-slate-500 mt-0.5">在下方单独设置导出筛选</span>
                </span>
              </label>
            </div>
          </div>

          {scope === 'custom' && (
            <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3 space-y-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">自定义筛选</p>
              <div className="grid grid-cols-2 gap-2">
                <FormSelect selectSize="sm"
                  value={customFilters.businessSectorId ?? ''}
                  onChange={(e) =>
                    patchCustom({
                      businessSectorId: e.target.value || undefined,
                      energyType: undefined,
                      businessStage: undefined,
                      businessNature: undefined,
                      domainLevelId: undefined,
                    })
                  }
                >
                  <option value="">业务板块</option>
                  {store.businessSectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect selectSize="sm"
                  value={customFilters.energyType ?? ''}
                  onChange={(e) => patchCustom({ energyType: e.target.value || undefined })}
                  disabled={linked.energyTypes.length === 0}
                >
                  <option value="">能源类型</option>
                  {linked.energyTypes.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect selectSize="sm"
                  value={customFilters.businessStage ?? ''}
                  onChange={(e) => patchCustom({ businessStage: e.target.value || undefined })}
                  disabled={linked.businessStages.length === 0}
                >
                  <option value="">业务阶段</option>
                  {linked.businessStages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect selectSize="sm"
                  value={customFilters.businessNature ?? ''}
                  onChange={(e) => patchCustom({ businessNature: e.target.value || undefined })}
                  disabled={linked.businessNatures.length === 0}
                >
                  <option value="">业务性质</option>
                  {linked.businessNatures.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect selectSize="sm"
                  value={customFilters.domainLevelId ?? ''}
                  onChange={(e) => patchCustom({ domainLevelId: e.target.value || undefined })}
                  disabled={linked.domainLevels.length === 0}
                  wrapperClassName="col-span-2"
                >
                  <option value="">系统/专业/阶段</option>
                  {linked.domainLevels.map((dl) => (
                    <option key={dl.id} value={dl.id}>
                      {dl.label}
                    </option>
                  ))}
                </FormSelect>
                <input
                  placeholder="品类名称 / 路径"
                  value={customFilters.lotName ?? ''}
                  onChange={(e) => patchCustom({ lotName: e.target.value || undefined })}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
                <FormSelect selectSize="sm"
                  value={customFilters.procurementMethod ?? ''}
                  onChange={(e) =>
                    patchCustom({
                      procurementMethod: (e.target.value || undefined) as ProcurementMethod | undefined,
                    })
                  }
                >
                  <option value="">采购方式</option>
                  {PROCUREMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PROCUREMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect selectSize="sm"
                  value={customFilters.evaluationMethod ?? ''}
                  onChange={(e) =>
                    patchCustom({
                      evaluationMethod: (e.target.value || undefined) as EvaluationMethod | undefined,
                    })
                  }
                >
                  <option value="">评审办法</option>
                  {EVALUATION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {EVALUATION_METHOD_LABELS[m]}
                    </option>
                  ))}
                </FormSelect>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">文件格式</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Excel (.xlsx)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} />
                CSV（UTF-8 BOM）
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2.5 text-sm">
            <span className="text-slate-600">
              预计导出 <span className="font-semibold text-blue-700 tabular-nums">{previewCount}</span> 条
            </span>
            <span className="text-[10px] text-slate-400">{EXPORT_HEADERS.length} 列</span>
          </div>

          <details className="text-[10px] text-slate-400 border border-slate-100 rounded-lg">
            <summary className="px-3 py-2 cursor-pointer hover:bg-slate-50">导出字段说明</summary>
            <p className="px-3 pb-2 leading-relaxed">{EXPORT_HEADERS.join(' · ')}</p>
          </details>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={previewCount === 0}
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出 {previewCount} 条
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
