'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ClassificationStore, LotLevel } from '@/types';
import {
  EVALUATION_METHODS,
  EVALUATION_METHOD_LABELS,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_LABELS,
  DOMAIN_LEVEL_NONE_NAV_ID,
  type EvaluationMethod,
  type ProcurementMethod,
} from '@/lib/classification/constants';
import { buildBusinessTypeDisplayName } from '@/lib/classification/code';
import type { LotFormInput } from '@/lib/classification/crud';
import {
  getLotFormBusinessNatures,
  getLotFormBusinessStages,
  getLotFormDomainLevels,
  getLotFormEnergyTypes,
  getLotFormLotNames,
  hasLotsWithoutDomain,
  LOT_FORM_CUSTOM_NAME,
  resolveLotFormBusinessType,
} from '@/lib/classification/form-cascade';
import { getClassificationStore } from '@/lib/classification/storage';
import { FormSelect } from '@/components/ui/FormSelect';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { categoryUi } from './category-ui';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 mb-3"
      style={{ paddingBottom: 8, borderBottom: '1px solid #F2F3F5' }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#4E5969',
          letterSpacing: '0.02em',
          textTransform: 'uppercase' as const,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-[12px] font-medium text-[#4E5969]">
      {children}
      {required ? <span className="text-[#F54A45]"> *</span> : null}
    </span>
  );
}

type Props = {
  open: boolean;
  editing?: LotLevel | null;
  onClose: () => void;
  onSubmit: (input: LotFormInput) => void;
  error?: string | null;
};

export function LotFormDialog({ open, editing, onClose, onSubmit, error }: Props) {
  const [store, setStore] = useState<ClassificationStore>(() => getClassificationStore());
  const [businessSectorId, setBusinessSectorId] = useState('');
  const [energyType, setEnergyType] = useState('');
  const [businessStage, setBusinessStage] = useState('');
  const [businessNature, setBusinessNature] = useState('');
  const [domainLevelId, setDomainLevelId] = useState('');
  const [lotNamePick, setLotNamePick] = useState('');
  const [customLotName, setCustomLotName] = useState('');
  const [procurementMethods, setProcurementMethods] = useState<ProcurementMethod[]>([]);
  const [evaluationMethod, setEvaluationMethod] = useState<EvaluationMethod | ''>('');
  const [sectorDescription, setSectorDescription] = useState('');
  const [businessTypeDescription, setBusinessTypeDescription] = useState('');
  const [domainLevelDescription, setDomainLevelDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const cascadeState = useMemo(
    () => ({ businessSectorId, energyType, businessStage, businessNature, domainLevelId }),
    [businessSectorId, energyType, businessStage, businessNature, domainLevelId],
  );

  const energyOptions = useMemo(
    () => getLotFormEnergyTypes(store, businessSectorId),
    [store, businessSectorId],
  );
  const stageOptions = useMemo(
    () => getLotFormBusinessStages(store, businessSectorId, energyType),
    [store, businessSectorId, energyType],
  );
  const natureOptions = useMemo(
    () => getLotFormBusinessNatures(store, businessSectorId, energyType, businessStage),
    [store, businessSectorId, energyType, businessStage],
  );
  const matchedBusinessType = useMemo(
    () => resolveLotFormBusinessType(store, cascadeState),
    [store, cascadeState],
  );
  const domainOptions = useMemo(
    () => getLotFormDomainLevels(store, matchedBusinessType?.id ?? ''),
    [store, matchedBusinessType?.id],
  );
  const showDomainNone = useMemo(
    () =>
      matchedBusinessType
        ? hasLotsWithoutDomain(store, businessSectorId, matchedBusinessType.id)
        : false,
    [store, businessSectorId, matchedBusinessType],
  );
  const lotNameOptions = useMemo(
    () => getLotFormLotNames(store, cascadeState, domainLevelId),
    [store, cascadeState, domainLevelId],
  );

  const applyDescriptions = (
    s: ClassificationStore,
    sectorId: string,
    energy: string,
    stage: string,
    nature: string,
    domainId: string,
  ) => {
    const sector = s.businessSectors.find((x) => x.id === sectorId);
    const bt = s.businessTypes.find(
      (b) =>
        b.businessSectorId === sectorId &&
        b.energyType === energy &&
        b.businessStage === stage &&
        b.businessNature === nature,
    );
    const dl =
      domainId && domainId !== DOMAIN_LEVEL_NONE_NAV_ID
        ? s.domainLevels.find((d) => d.id === domainId)
        : undefined;
    setSectorDescription(sector?.description ?? '');
    setBusinessTypeDescription(bt?.description ?? '');
    setDomainLevelDescription(dl?.description ?? '');
  };

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    const nextStore = getClassificationStore();
    setStore(nextStore);

    if (editing) {
      const sector = nextStore.businessSectors.find((s) => s.id === editing.businessSectorId);
      const bt = nextStore.businessTypes.find((b) => b.id === editing.businessTypeId);
      const domain = editing.domainLevelId
        ? nextStore.domainLevels.find((d) => d.id === editing.domainLevelId)
        : undefined;
      const sectorId = editing.businessSectorId;
      const energy = bt?.energyType ?? '';
      const stage = bt?.businessStage ?? '';
      const nature = bt?.businessNature ?? '';
      const domainId = editing.domainLevelId ?? DOMAIN_LEVEL_NONE_NAV_ID;

      setBusinessSectorId(sectorId);
      setEnergyType(energy);
      setBusinessStage(stage);
      setBusinessNature(nature);
      setDomainLevelId(domainId);
      setLotNamePick(editing.name);
      setCustomLotName('');
      setProcurementMethods([...editing.procurementMethods]);
      setEvaluationMethod(editing.evaluationMethods[0] ?? '');
      setSectorDescription(sector?.description ?? '');
      setBusinessTypeDescription(bt?.description ?? '');
      setDomainLevelDescription(domain?.description ?? '');
    } else {
      const defaultSector = nextStore.businessSectors[0];
      const sectorId = defaultSector?.id ?? '';
      const energies = getLotFormEnergyTypes(nextStore, sectorId);
      const energy = energies[0] ?? '';
      const stages = getLotFormBusinessStages(nextStore, sectorId, energy);
      const stage = stages[0] ?? '';
      const natures = getLotFormBusinessNatures(nextStore, sectorId, energy, stage);
      const nature = natures[0] ?? '';
      const bt = resolveLotFormBusinessType(nextStore, {
        businessSectorId: sectorId,
        energyType: energy,
        businessStage: stage,
        businessNature: nature,
        domainLevelId: '',
      });
      const domainId =
        bt && hasLotsWithoutDomain(nextStore, sectorId, bt.id)
          ? DOMAIN_LEVEL_NONE_NAV_ID
          : getLotFormDomainLevels(nextStore, bt?.id ?? '')[0]?.id ?? '';

      setBusinessSectorId(sectorId);
      setEnergyType(energy);
      setBusinessStage(stage);
      setBusinessNature(nature);
      setDomainLevelId(domainId);
      setLotNamePick(LOT_FORM_CUSTOM_NAME);
      setCustomLotName('');
      setProcurementMethods(['open_tender']);
      setEvaluationMethod('comprehensive_score');
      applyDescriptions(nextStore, sectorId, energy, stage, nature, domainId);
    }
  }, [open, editing]);

  if (!open) return null;

  const displayName = buildBusinessTypeDisplayName(energyType, businessStage, businessNature);
  const displayError = localError ?? error;
  const useCustomLotName = !editing && lotNamePick === LOT_FORM_CUSTOM_NAME;
  const resolvedLotName = useCustomLotName ? customLotName.trim() : lotNamePick.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!businessSectorId) {
      setLocalError('请选择业务板块');
      return;
    }
    if (!energyType || !businessStage || !businessNature) {
      setLocalError('请选择能源类型、业务阶段与业务性质');
      return;
    }
    if (!domainLevelId) {
      setLocalError('请选择系统/专业/阶段，或选择「无系统/专业/阶段」');
      return;
    }
    if (!resolvedLotName) {
      setLocalError(useCustomLotName ? '请填写新品类名称' : '请选择品类级别');
      return;
    }
    if (procurementMethods.length === 0) {
      setLocalError('请至少选择一种采购方式');
      return;
    }
    if (!evaluationMethod) {
      setLocalError('请选择评审办法');
      return;
    }

    onSubmit({
      businessSectorId,
      energyType,
      businessStage,
      businessNature,
      domainLevelId:
        domainLevelId === DOMAIN_LEVEL_NONE_NAV_ID ? undefined : domainLevelId || undefined,
      lotName: resolvedLotName,
      procurementMethods: [...new Set(procurementMethods)],
      evaluationMethods: [evaluationMethod],
      sectorDescription: sectorDescription.trim() || undefined,
      businessTypeDescription: businessTypeDescription.trim() || undefined,
      domainLevelDescription: domainLevelDescription.trim() || undefined,
    });
  };

  const toggleProcurement = (method: ProcurementMethod) => {
    setProcurementMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  };

  const onSectorChange = (sectorId: string) => {
    const sector = store.businessSectors.find((s) => s.id === sectorId);
    const energies = getLotFormEnergyTypes(store, sectorId);
    const energy = energies[0] ?? '';
    const stages = getLotFormBusinessStages(store, sectorId, energy);
    const stage = stages[0] ?? '';
    const natures = getLotFormBusinessNatures(store, sectorId, energy, stage);
    const nature = natures[0] ?? '';
    const bt = resolveLotFormBusinessType(store, {
      businessSectorId: sectorId,
      energyType: energy,
      businessStage: stage,
      businessNature: nature,
      domainLevelId: '',
    });
    const nextDomainId =
      bt && hasLotsWithoutDomain(store, sectorId, bt.id)
        ? DOMAIN_LEVEL_NONE_NAV_ID
        : getLotFormDomainLevels(store, bt?.id ?? '')[0]?.id ?? '';

    setBusinessSectorId(sectorId);
    setEnergyType(energy);
    setBusinessStage(stage);
    setBusinessNature(nature);
    setDomainLevelId(nextDomainId);
    setLotNamePick(editing ? '' : LOT_FORM_CUSTOM_NAME);
    setCustomLotName('');
    applyDescriptions(store, sectorId, energy, stage, nature, nextDomainId);
  };

  const onEnergyChange = (value: string) => {
    const stages = getLotFormBusinessStages(store, businessSectorId, value);
    const stage = stages.includes(businessStage) ? businessStage : stages[0] ?? '';
    const natures = getLotFormBusinessNatures(store, businessSectorId, value, stage);
    const nature = natures.includes(businessNature) ? businessNature : natures[0] ?? '';
    const bt = resolveLotFormBusinessType(store, {
      businessSectorId,
      energyType: value,
      businessStage: stage,
      businessNature: nature,
      domainLevelId: '',
    });
    const nextDomainId =
      bt && hasLotsWithoutDomain(store, businessSectorId, bt.id)
        ? DOMAIN_LEVEL_NONE_NAV_ID
        : getLotFormDomainLevels(store, bt?.id ?? '')[0]?.id ?? '';

    setEnergyType(value);
    setBusinessStage(stage);
    setBusinessNature(nature);
    setDomainLevelId(nextDomainId);
    setLotNamePick(editing ? '' : LOT_FORM_CUSTOM_NAME);
    setCustomLotName('');
    applyDescriptions(store, businessSectorId, value, stage, nature, nextDomainId);
  };

  const onStageChange = (value: string) => {
    const natures = getLotFormBusinessNatures(store, businessSectorId, energyType, value);
    const nature = natures.includes(businessNature) ? businessNature : natures[0] ?? '';
    const bt = resolveLotFormBusinessType(store, {
      businessSectorId,
      energyType,
      businessStage: value,
      businessNature: nature,
      domainLevelId: '',
    });
    const nextDomainId =
      bt && hasLotsWithoutDomain(store, businessSectorId, bt.id)
        ? DOMAIN_LEVEL_NONE_NAV_ID
        : getLotFormDomainLevels(store, bt?.id ?? '')[0]?.id ?? '';

    setBusinessStage(value);
    setBusinessNature(nature);
    setDomainLevelId(nextDomainId);
    setLotNamePick(editing ? '' : LOT_FORM_CUSTOM_NAME);
    setCustomLotName('');
    applyDescriptions(store, businessSectorId, energyType, value, nature, nextDomainId);
  };

  const onNatureChange = (value: string) => {
    const bt = resolveLotFormBusinessType(store, {
      businessSectorId,
      energyType,
      businessStage,
      businessNature: value,
      domainLevelId: '',
    });
    const nextDomainId =
      bt && hasLotsWithoutDomain(store, businessSectorId, bt.id)
        ? DOMAIN_LEVEL_NONE_NAV_ID
        : getLotFormDomainLevels(store, bt?.id ?? '')[0]?.id ?? '';

    setBusinessNature(value);
    setDomainLevelId(nextDomainId);
    setLotNamePick(editing ? '' : LOT_FORM_CUSTOM_NAME);
    setCustomLotName('');
    applyDescriptions(store, businessSectorId, energyType, businessStage, value, nextDomainId);
  };

  const onDomainChange = (value: string) => {
    setDomainLevelId(value);
    setLotNamePick(editing ? '' : LOT_FORM_CUSTOM_NAME);
    setCustomLotName('');
    applyDescriptions(
      store,
      businessSectorId,
      energyType,
      businessStage,
      businessNature,
      value,
    );
  };

  const selectProps = {
    selectSize: 'md' as const,
    wrapperClassName: 'mt-1',
  };

  return (
    <ModalOverlay>
      <div
        className="bg-white flex flex-col"
        style={{
          width: 960,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          borderRadius: 10,
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 56, borderBottom: '1px solid #F2F3F5' }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>
            {editing ? '编辑品类' : '新增品类'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-[#8F959E] hover:bg-[#F5F6F7] hover:text-[#1F2329] transition-colors"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-6 py-5"
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {displayError && (
            <div
              className="text-[13px] rounded-lg px-3 py-2"
              style={{
                color: '#F54A45',
                background: '#FFF0EF',
                border: '1px solid #FFD9D8',
              }}
            >
              {displayError}
            </div>
          )}

          <section>
            <SectionTitle>基础信息</SectionTitle>
            <div className="grid grid-cols-4 gap-4">
              <div className="block">
                <label className="block">
                  <FieldLabel required>业务板块</FieldLabel>
                  <FormSelect
                    {...selectProps}
                    value={businessSectorId}
                    onChange={(e) => onSectorChange(e.target.value)}
                    required
                  >
                    <option value="">请选择</option>
                    {store.businessSectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </FormSelect>
                </label>
                <label className="block mt-2">
                  <span className="text-[12px] font-medium text-[#4E5969]">业务板块说明</span>
                  <textarea
                    value={sectorDescription}
                    onChange={(e) => setSectorDescription(e.target.value)}
                    rows={2}
                    className={categoryUi.formTextarea}
                    placeholder="一级分类业务解释"
                  />
                </label>
              </div>
              <label className="block">
                <FieldLabel required>能源类型</FieldLabel>
                <FormSelect
                  {...selectProps}
                  value={energyType}
                  onChange={(e) => onEnergyChange(e.target.value)}
                  disabled={!businessSectorId || energyOptions.length === 0}
                  required
                >
                  <option value="">请选择</option>
                  {energyOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
              </label>
              <label className="block">
                <FieldLabel required>业务阶段</FieldLabel>
                <FormSelect
                  {...selectProps}
                  value={businessStage}
                  onChange={(e) => onStageChange(e.target.value)}
                  disabled={!energyType || stageOptions.length === 0}
                  required
                >
                  <option value="">请选择</option>
                  {stageOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
              </label>
              <label className="block">
                <FieldLabel required>业务性质</FieldLabel>
                <FormSelect
                  {...selectProps}
                  value={businessNature}
                  onChange={(e) => onNatureChange(e.target.value)}
                  disabled={!businessStage || natureOptions.length === 0}
                  required
                >
                  <option value="">请选择</option>
                  {natureOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FormSelect>
              </label>
            </div>
            {displayName && displayName !== '--' && (
              <div
                className="mt-2 px-3 py-2 rounded-lg"
                style={{
                  background: '#F7F9FF',
                  border: '1px solid #E0E9FF',
                  fontSize: 12,
                  color: '#4E5969',
                }}
              >
                业务类型展示名：
                <span style={{ fontWeight: 500, color: '#3370FF' }}>{displayName}</span>
              </div>
            )}
            <label className="block mt-3">
              <span className="text-[12px] font-medium text-[#4E5969]">业务类型说明</span>
              <textarea
                value={businessTypeDescription}
                onChange={(e) => setBusinessTypeDescription(e.target.value)}
                rows={2}
                className={categoryUi.formTextarea}
                placeholder="二级分类（能源/阶段/性质）说明"
              />
            </label>
          </section>

          <section>
            <SectionTitle>分类信息</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div className="block">
                <label className="block">
                  <FieldLabel>
                    系统/专业/阶段
                    <span className="text-[#8F959E] font-normal ml-1">（可选）</span>
                  </FieldLabel>
                  <FormSelect
                    {...selectProps}
                    value={domainLevelId}
                    onChange={(e) => onDomainChange(e.target.value)}
                    disabled={!matchedBusinessType}
                    required={!!matchedBusinessType}
                  >
                    <option value="">请选择</option>
                    {domainOptions.map((dl) => (
                      <option key={dl.id} value={dl.id}>
                        {dl.name}
                      </option>
                    ))}
                    {showDomainNone && (
                      <option value={DOMAIN_LEVEL_NONE_NAV_ID}>（无系统/专业/阶段）</option>
                    )}
                  </FormSelect>
                </label>
                <label className="block mt-2">
                  <span className="text-[12px] font-medium text-[#4E5969]">系统/专业/阶段说明</span>
                  <textarea
                    value={domainLevelDescription}
                    onChange={(e) => setDomainLevelDescription(e.target.value)}
                    rows={2}
                    className={categoryUi.formTextarea}
                    placeholder="三级分类说明"
                  />
                </label>
              </div>
              <div className="block">
                <label className="block">
                  <FieldLabel required>品类级别</FieldLabel>
                  <FormSelect
                    {...selectProps}
                    value={lotNamePick}
                    onChange={(e) => setLotNamePick(e.target.value)}
                    disabled={!domainLevelId}
                    required
                  >
                    <option value="">请选择</option>
                    {lotNameOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    {!editing && (
                      <option value={LOT_FORM_CUSTOM_NAME}>+ 输入新品类名称</option>
                    )}
                  </FormSelect>
                </label>
                {useCustomLotName && (
                  <label className="block mt-2">
                    <span className="text-[12px] font-medium text-[#4E5969]">新品类名称</span>
                    <input
                      value={customLotName}
                      onChange={(e) => setCustomLotName(e.target.value)}
                      className={categoryUi.formField}
                      placeholder="如 前期咨询服务"
                      required
                    />
                  </label>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>规则配置</SectionTitle>
            <fieldset className="mb-4">
              <legend className="text-[12px] font-medium text-[#4E5969] mb-2">
                采购方式 <span className="text-[#F54A45]">*</span>
                <span className="text-[#8F959E] font-normal ml-1">（可多选）</span>
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {PROCUREMENT_METHODS.map((m) => {
                  const checked = procurementMethods.includes(m);
                  return (
                    <label
                      key={m}
                      className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2.5 transition-colors"
                      style={{
                        border: `1px solid ${checked ? '#3370FF' : '#DEE0E3'}`,
                        background: checked ? '#EEF3FF' : '#FAFBFC',
                        fontSize: 13,
                        color: checked ? '#3370FF' : '#1F2329',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProcurement(m)}
                        className="w-3.5 h-3.5 rounded border border-slate-300 accent-blue-600"
                      />
                      {PROCUREMENT_METHOD_LABELS[m]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block max-w-xs">
              <FieldLabel required>
                评审办法
                <span className="text-[#8F959E] font-normal ml-1">（单选）</span>
              </FieldLabel>
              <FormSelect
                value={evaluationMethod}
                onChange={(e) => setEvaluationMethod(e.target.value as EvaluationMethod | '')}
                wrapperClassName="mt-1"
                required
              >
                <option value="">请选择</option>
                {EVALUATION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {EVALUATION_METHOD_LABELS[m]}
                  </option>
                ))}
              </FormSelect>
            </label>
          </section>
        </form>

        <div
          className="flex justify-end items-center gap-2 px-6 shrink-0"
          style={{ height: 56, borderTop: '1px solid #F2F3F5', background: '#FAFBFC' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-sm text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-8 px-5 text-[13px] font-medium text-white rounded-lg hover:bg-[#2860ee] transition-colors"
            style={{ background: '#3370FF' }}
          >
            保存
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
