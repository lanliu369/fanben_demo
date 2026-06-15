'use client';

import { useEffect, useRef } from 'react';
import type { ClassificationStore } from '@/types';
import { parseTemplateName } from '@/lib/classification/parse-template-name';
import { LotCascadeFields, type LotCascadeValue } from '@/components/classification/LotCascadeFields';
import { LotLevelMultiSelect } from '@/components/classification/LotLevelMultiSelect';

export type TemplateLotMetaValue = LotCascadeValue & {
  name: string;
  description: string;
  version: string;
  lotLevelIds: string[];
};

export function emptyTemplateLotMeta(): TemplateLotMetaValue {
  return {
    name: '',
    description: '',
    version: '',
    businessSectorId: '',
    energyType: '',
    businessStage: '',
    businessNature: '',
    domainLevelId: '',
    lotLevelId: '',
    lotLevelIds: [],
  };
}

type Props = {
  value: TemplateLotMetaValue;
  onChange: (value: TemplateLotMetaValue) => void;
  store: ClassificationStore;
  versionPlaceholder?: string;
};

export function TemplateLotMetaFields({ value, onChange, store, versionPlaceholder }: Props) {
  const parseGenRef = useRef(0);
  const cascadeManualRef = useRef(false);
  const lotsManualRef = useRef(false);

  useEffect(() => {
    const name = value.name.trim();
    if (!name) return;

    const gen = ++parseGenRef.current;
    const timer = window.setTimeout(() => {
      if (gen !== parseGenRef.current) return;
      const parsed = parseTemplateName(name, store);

      onChange({
        ...value,
        ...(cascadeManualRef.current ? {} : parsed.cascade),
        lotLevelIds: lotsManualRef.current ? value.lotLevelIds : parsed.matchedLotIds,
        lotLevelId: (lotsManualRef.current ? value.lotLevelIds : parsed.matchedLotIds)[0] ?? '',
      });
    }, 320);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随名称变化触发自动匹配
  }, [value.name, store]);

  const parsePreview = value.name.trim() ? parseTemplateName(value.name, store) : null;

  const handleCascadeChange = (cascade: LotCascadeValue) => {
    cascadeManualRef.current = true;
    const keptLots = value.lotLevelIds.filter((id) => {
      const lot = store.lotLevels.find((l) => l.id === id);
      if (!lot) return false;
      if (cascade.businessSectorId && lot.businessSectorId !== cascade.businessSectorId) return false;
      const bt = store.businessTypes.find((b) => b.id === lot.businessTypeId);
      if (!bt) return false;
      if (cascade.energyType && bt.energyType !== cascade.energyType) return false;
      if (cascade.businessStage && bt.businessStage !== cascade.businessStage) return false;
      if (cascade.businessNature && bt.businessNature !== cascade.businessNature) return false;
      return true;
    });
    onChange({
      ...value,
      ...cascade,
      lotLevelIds: keptLots,
      lotLevelId: keptLots[0] ?? '',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          范本名称 <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => {
            cascadeManualRef.current = false;
            lotsManualRef.current = false;
            onChange({ ...value, name: e.target.value });
          }}
          placeholder="如：海上风电测风服务EPC招标范本"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          提示：名称内需要包含准确的品类名称（业务板块、能源类型、标段级别等），系统将自动拆分并匹配下方字段
        </p>
      </div>

      {parsePreview && value.name.trim() && (
        <div className="text-xs rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 space-y-1">
          {parsePreview.matchedLabels.length > 0 ? (
            <p className="text-slate-600">
              已识别：
              <span className="text-slate-800 font-medium ml-1">
                {parsePreview.matchedLabels.join(' / ')}
              </span>
            </p>
          ) : null}
          {parsePreview.warnings.map((w) => (
            <p
              key={w}
              className={
                w.includes('已自动多选')
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }
            >
              {w}
            </p>
          ))}
        </div>
      )}

      <LotCascadeFields
        value={value}
        onChange={handleCascadeChange}
        store={store}
        required
        hideLotLevel
      />

      <LotLevelMultiSelect
        cascade={value}
        selectedIds={value.lotLevelIds}
        onChange={(lotLevelIds) => {
          lotsManualRef.current = true;
          onChange({
            ...value,
            lotLevelIds,
            lotLevelId: lotLevelIds[0] ?? '',
          });
        }}
        store={store}
        required
      />

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
        <input
          type="text"
          value={value.version}
          onChange={(e) => onChange({ ...value, version: e.target.value })}
          placeholder={value.lotLevelIds.length ? (versionPlaceholder ?? '如 V1.0') : '请先选择标段'}
          disabled={value.lotLevelIds.length === 0}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">范本描述</label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="请输入范本描述"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
