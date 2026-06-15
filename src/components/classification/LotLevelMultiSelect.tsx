'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ClassificationStore } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from '@/lib/classification/constants';
import type { LotCascadeValue } from '@/components/classification/LotCascadeFields';

type Props = {
  cascade: LotCascadeValue;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  store: ClassificationStore;
  required?: boolean;
};

function buildDisplayLabel(selectedIds: string[], lots: { id: string; name: string }[]): string {
  if (selectedIds.length === 0) return '请选择（可多选）';
  const names = selectedIds
    .map((id) => lots.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join('、');
  return `已选 ${names.length} 项：${names.slice(0, 2).join('、')}…`;
}

export function LotLevelMultiSelect({ cascade, selectedIds, onChange, store, required }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const lots = useMemo(() => {
    const sectorBusinessTypes = store.businessTypes.filter(
      (bt) => bt.businessSectorId === cascade.businessSectorId,
    );
    const matchedBusinessType = sectorBusinessTypes.find(
      (bt) =>
        bt.energyType === cascade.energyType
        && bt.businessStage === cascade.businessStage
        && bt.businessNature === cascade.businessNature,
    );
    const matchedBusinessTypeId = matchedBusinessType?.id ?? '';
    if (!matchedBusinessTypeId || !cascade.domainLevelId) return [];

    return store.lotLevels.filter((l) => {
      if (cascade.businessSectorId && l.businessSectorId !== cascade.businessSectorId) return false;
      if (l.businessTypeId !== matchedBusinessTypeId) return false;
      if (cascade.domainLevelId === DOMAIN_LEVEL_NONE_NAV_ID) return !l.domainLevelId;
      return l.domainLevelId === cascade.domainLevelId;
    });
  }, [cascade, store]);

  const disabled = lots.length === 0;
  const displayLabel = buildDisplayLabel(selectedIds, lots);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = (lotId: string) => {
    if (selectedIds.includes(lotId)) {
      onChange(selectedIds.filter((id) => id !== lotId));
    } else {
      onChange([...selectedIds, lotId]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        标段级别（可多选）
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {disabled ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 h-9 flex items-center">
          请先输入范本名称以自动匹配品类，或手动选择上方各层级字段
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`relative w-full h-9 pl-3 pr-9 text-left text-sm rounded-lg border bg-white outline-none transition-colors ${
              open
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300'
            } ${selectedIds.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}
          >
            <span className="block truncate">{displayLabel}</span>
            <ChevronDown
              aria-hidden
              className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>

          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
              {lots.map((lot) => {
                const checked = selectedIds.includes(lot.id);
                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => toggle(lot.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      checked ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center ${
                        checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                      }`}
                      aria-hidden
                    >
                      {checked ? (
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor">
                          <path d="M10.2 3.2 4.8 8.6 1.8 5.6l1.1-1.1 1.9 1.9 4.3-4.3 1.1 1.1z" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="truncate">{lot.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {selectedIds.length > 1 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-1.5">
          已选 {selectedIds.length} 个标段，确认后将生成 {selectedIds.length} 个范本
        </p>
      )}
    </div>
  );
}
