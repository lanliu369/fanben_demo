'use client';

import { useEffect, useRef } from 'react';
import type { ClassificationStore } from '@/types';
import {
  buildAutoTemplateName,
  parseTemplateName,
} from '@/lib/classification/parse-template-name';
import { LotCascadeFields, type LotCascadeValue } from '@/components/classification/LotCascadeFields';

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
  /** 通用模版管理等场景不展示版本号 */
  hideVersion?: boolean;
  /** 从范本描述解析品类要素（新建范本） */
  parseFromDescription?: boolean;
  /** 按业务板块+能源类型+业务阶段+品类名称自动生成范本名称 */
  autoGenerateName?: boolean;
  /** 名称/描述字段用语，默认「范本」；通用模版管理等场景传「模版」 */
  entityLabel?: '范本' | '模版';
};

export function TemplateLotMetaFields({
  value,
  onChange,
  store,
  versionPlaceholder,
  hideVersion,
  parseFromDescription = false,
  autoGenerateName = false,
  entityLabel = '范本',
}: Props) {
  const parseGenRef = useRef(0);
  const cascadeManualRef = useRef(false);
  const lotsManualRef = useRef(false);
  const nameManualRef = useRef(false);
  const prevAutoNameLotIdRef = useRef<string | null>(null);

  const parseSource = parseFromDescription ? value.description : value.name;

  useEffect(() => {
    const source = parseSource.trim();
    if (!source) return;

    const gen = ++parseGenRef.current;
    const timer = window.setTimeout(() => {
      if (gen !== parseGenRef.current) return;
      const parsed = parseTemplateName(source, store);

      onChange({
        ...value,
        ...(cascadeManualRef.current ? {} : parsed.cascade),
        lotLevelIds: lotsManualRef.current ? value.lotLevelIds : parsed.matchedLotIds,
        lotLevelId: (lotsManualRef.current ? value.lotLevelIds : parsed.matchedLotIds)[0] ?? '',
      });
    }, 320);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随解析源变化触发自动匹配
  }, [parseSource, store, parseFromDescription]);

  const parsePreview = parseSource.trim() ? parseTemplateName(parseSource, store) : null;

  useEffect(() => {
    if (!autoGenerateName) return;
    const lotId = value.lotLevelIds[0] || value.lotLevelId;
    if (!lotId) {
      if (value.name) onChange({ ...value, name: '' });
      nameManualRef.current = false;
      prevAutoNameLotIdRef.current = null;
      return;
    }
    if (value.lotLevelIds[0] !== lotId) {
      onChange({ ...value, lotLevelIds: [lotId], lotLevelId: lotId });
      return;
    }
    if (lotId !== prevAutoNameLotIdRef.current) {
      nameManualRef.current = false;
      prevAutoNameLotIdRef.current = lotId;
    }
    if (nameManualRef.current) return;
    const autoName = buildAutoTemplateName(store, lotId);
    if (autoName && autoName !== value.name) {
      onChange({ ...value, name: autoName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 随品类选择更新自动名称
  }, [autoGenerateName, value.lotLevelIds, value.lotLevelId, store]);

  useEffect(() => {
    if (!value.lotLevelId) return;
    if (value.lotLevelIds[0] === value.lotLevelId) return;
    onChange({ ...value, lotLevelIds: [value.lotLevelId] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 保持 lotLevelId 与 lotLevelIds 同步
  }, [value.lotLevelId, value.lotLevelIds]);

  const handleCascadeChange = (cascade: LotCascadeValue) => {
    cascadeManualRef.current = true;
    const lotId = cascade.lotLevelId;
    onChange({
      ...value,
      ...cascade,
      lotLevelIds: lotId ? [lotId] : [],
    });
  };

  const descriptionBlock = (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{entityLabel}描述</label>
      <textarea
        value={value.description}
        onChange={(e) => {
          if (parseFromDescription) {
            cascadeManualRef.current = false;
            lotsManualRef.current = false;
          }
          onChange({ ...value, description: e.target.value });
        }}
        placeholder={
          parseFromDescription
            ? `如：海上风电测风服务EPC招标${entityLabel}（含业务板块、能源类型、品类名称等要素，系统将自动匹配下方字段）`
            : `请输入${entityLabel}描述`
        }
        rows={parseFromDescription ? 3 : 2}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
      />
      {parseFromDescription ? (
        <p className="text-xs text-slate-500 mt-1.5">
          提示：描述内需要包含准确的品类名称（业务板块、能源类型、品类级别等），系统将自动拆分并匹配下方字段
        </p>
      ) : null}
    </div>
  );

  const nameBlock = autoGenerateName ? (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {entityLabel}名称 <span className="text-rose-500">*</span>
      </label>
      {value.lotLevelIds.length === 0 && !value.lotLevelId ? (
        <p className="text-sm text-slate-400 px-3 py-2 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          选择品类后自动生成（业务板块 + 能源类型 + 业务阶段 + 品类名称 + 招标{entityLabel}）
        </p>
      ) : (
        <>
          <input
            type="text"
            required
            value={value.name}
            onChange={(e) => {
              nameManualRef.current = true;
              onChange({ ...value, name: e.target.value });
            }}
            placeholder="选择品类后自动生成，可按需修改"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              value.name.trim()
                ? 'border-slate-200 text-slate-800'
                : 'border-amber-200 text-amber-700'
            }`}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            默认按「业务板块 + 能源类型 + 业务阶段 + 品类名称 + 招标{entityLabel}」生成，支持手动调整
          </p>
        </>
      )}
    </div>
  ) : (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {entityLabel}名称 <span className="text-rose-500">*</span>
      </label>
      <input
        type="text"
        value={value.name}
        onChange={(e) => {
          cascadeManualRef.current = false;
          lotsManualRef.current = false;
          onChange({ ...value, name: e.target.value });
        }}
        placeholder={`如：海上风电测风服务EPC招标${entityLabel}`}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
      <p className="text-xs text-slate-500 mt-1.5">
        提示：名称内需要包含准确的品类名称（业务板块、能源类型、品类级别等），系统将自动拆分并匹配下方字段
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {parseFromDescription ? descriptionBlock : nameBlock}

      {!parseFromDescription && parsePreview && value.name.trim() && (
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
              className={w.includes('已选用第一个') ? 'text-blue-700' : 'text-amber-700'}
            >
              {w}
            </p>
          ))}
        </div>
      )}

      {parseFromDescription && parsePreview && parseSource.trim() && (
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
              className={w.includes('已选用第一个') ? 'text-blue-700' : 'text-amber-700'}
            >
              {w}
            </p>
          ))}
        </div>
      )}

      <LotCascadeFields
        value={value}
        onChange={(cascade) => {
          if (cascade.lotLevelId !== value.lotLevelId) {
            lotsManualRef.current = true;
          }
          handleCascadeChange(cascade);
        }}
        store={store}
        required
      />

      {!hideVersion && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
          <input
            type="text"
            value={value.version}
            onChange={(e) => onChange({ ...value, version: e.target.value })}
            placeholder={value.lotLevelIds.length ? (versionPlaceholder ?? '如 V1.0') : '请先选择品类'}
            disabled={value.lotLevelIds.length === 0}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      )}

      {parseFromDescription ? nameBlock : descriptionBlock}
    </div>
  );
}
