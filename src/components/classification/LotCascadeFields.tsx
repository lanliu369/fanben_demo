'use client';

import { useMemo } from 'react';
import type { ClassificationStore } from '@/types';
import { DOMAIN_LEVEL_NONE_NAV_ID } from '@/lib/classification/constants';
import {
  emptyLotCascade,
  lotCascadeFromLotId,
  type LotCascadeValue,
} from '@/lib/classification/lot-cascade';
import { getClassificationStore } from '@/lib/classification/storage';
import { FormSelect } from '@/components/ui/FormSelect';

export type { LotCascadeValue };
export { emptyLotCascade, lotCascadeFromLotId };

type Props = {
  value: LotCascadeValue;
  onChange: (value: LotCascadeValue) => void;
  store?: ClassificationStore;
  required?: boolean;
  /** 隐藏标段单选（改由 LotLevelMultiSelect 承担） */
  hideLotLevel?: boolean;
};

export function LotCascadeFields({ value, onChange, store: storeProp, required, hideLotLevel }: Props) {
  const store = useMemo(() => storeProp ?? getClassificationStore(), [storeProp]);

  // 根据业务板块过滤
  const sectorBusinessTypes = store.businessTypes.filter(
    (bt) => bt.businessSectorId === value.businessSectorId,
  );

  // 能源类型列表（去重）
  const energyTypes = useMemo(() => {
    const set = new Set(sectorBusinessTypes.map((bt) => bt.energyType));
    return Array.from(set).filter(Boolean).sort();
  }, [sectorBusinessTypes]);

  // 业务阶段列表（根据已选能源类型过滤，去重）
  const businessStages = useMemo(() => {
    const filtered = sectorBusinessTypes.filter((bt) => bt.energyType === value.energyType);
    const set = new Set(filtered.map((bt) => bt.businessStage));
    return Array.from(set).filter(Boolean).sort();
  }, [sectorBusinessTypes, value.energyType]);

  // 业务性质列表（根据已选能源类型+业务阶段过滤，去重）
  const businessNatures = useMemo(() => {
    const filtered = sectorBusinessTypes.filter(
      (bt) => bt.energyType === value.energyType && bt.businessStage === value.businessStage,
    );
    const set = new Set(filtered.map((bt) => bt.businessNature));
    return Array.from(set).filter(Boolean).sort();
  }, [sectorBusinessTypes, value.energyType, value.businessStage]);

  // 匹配到的 businessTypeId
  const matchedBusinessType = useMemo(() => {
    return sectorBusinessTypes.find(
      (bt) =>
        bt.energyType === value.energyType &&
        bt.businessStage === value.businessStage &&
        bt.businessNature === value.businessNature,
    );
  }, [sectorBusinessTypes, value.energyType, value.businessStage, value.businessNature]);

  const matchedBusinessTypeId = matchedBusinessType?.id ?? '';

  // 系统/专业/阶段
  const domainLevels = store.domainLevels.filter(
    (dl) => dl.businessTypeId === matchedBusinessTypeId,
  );
  const hasLotsWithoutDomain = store.lotLevels.some(
    (l) =>
      l.businessTypeId === matchedBusinessTypeId &&
      l.businessSectorId === value.businessSectorId &&
      !l.domainLevelId,
  );

  // 标段级别
  const lots = store.lotLevels.filter((l) => {
    if (value.businessSectorId && l.businessSectorId !== value.businessSectorId) return false;
    if (matchedBusinessTypeId && l.businessTypeId !== matchedBusinessTypeId) return false;
    if (!value.domainLevelId) return false;
    if (value.domainLevelId === DOMAIN_LEVEL_NONE_NAV_ID) return !l.domainLevelId;
    return l.domainLevelId === value.domainLevelId;
  });

  const energyDisabled = !value.businessSectorId;
  const stageDisabled = !value.energyType;
  const natureDisabled = !value.businessStage;
  const domainSelectDisabled = !matchedBusinessTypeId;
  const lotSelectDisabled = !value.domainLevelId;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          业务板块 {required && <span className="text-rose-500">*</span>}
        </label>
        <FormSelect
          value={value.businessSectorId}
          onChange={(e) =>
            onChange({
              businessSectorId: e.target.value,
              energyType: '',
              businessStage: '',
              businessNature: '',
              domainLevelId: '',
              lotLevelId: '',
            })
          }
        >
          <option value="">请选择</option>
          {store.businessSectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FormSelect>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          能源类型 {required && <span className="text-rose-500">*</span>}
        </label>
        <FormSelect
          value={value.energyType}
          onChange={(e) =>
            onChange({
              ...value,
              energyType: e.target.value,
              businessStage: '',
              businessNature: '',
              domainLevelId: '',
              lotLevelId: '',
            })
          }
          disabled={energyDisabled}
        >
          <option value="">请选择</option>
          {energyTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </FormSelect>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          业务阶段 {required && <span className="text-rose-500">*</span>}
        </label>
        <FormSelect
          value={value.businessStage}
          onChange={(e) =>
            onChange({
              ...value,
              businessStage: e.target.value,
              businessNature: '',
              domainLevelId: '',
              lotLevelId: '',
            })
          }
          disabled={stageDisabled}
        >
          <option value="">请选择</option>
          {businessStages.map((bs) => (
            <option key={bs} value={bs}>
              {bs}
            </option>
          ))}
        </FormSelect>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          业务性质 {required && <span className="text-rose-500">*</span>}
        </label>
        <FormSelect
          value={value.businessNature}
          onChange={(e) =>
            onChange({
              ...value,
              businessNature: e.target.value,
              domainLevelId: '',
              lotLevelId: '',
            })
          }
          disabled={natureDisabled}
        >
          <option value="">请选择</option>
          {businessNatures.map((bn) => (
            <option key={bn} value={bn}>
              {bn}
            </option>
          ))}
        </FormSelect>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          系统/专业/阶段 {required && <span className="text-rose-500">*</span>}
        </label>
        <FormSelect
          value={value.domainLevelId}
          onChange={(e) =>
            onChange({
              ...value,
              domainLevelId: e.target.value,
              lotLevelId: '',
            })
          }
          disabled={domainSelectDisabled}
        >
          <option value="">请选择</option>
          {domainLevels.map((dl) => (
            <option key={dl.id} value={dl.id}>
              {dl.name}
            </option>
          ))}
          {hasLotsWithoutDomain && (
            <option value={DOMAIN_LEVEL_NONE_NAV_ID}>（无系统/专业/阶段）</option>
          )}
        </FormSelect>
      </div>
      {!hideLotLevel && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            标段级别 {required && <span className="text-rose-500">*</span>}
          </label>
          <FormSelect
            value={value.lotLevelId}
            onChange={(e) => onChange({ ...value, lotLevelId: e.target.value })}
            disabled={lotSelectDisabled}
          >
            <option value="">请选择</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </FormSelect>
        </div>
      )}
    </div>
  );
}
