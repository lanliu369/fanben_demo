'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { categoryUi } from '@/components/classification/category-ui';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  EVALUATION_METHODS,
  EVALUATION_METHOD_LABELS,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_LABELS,
  type EvaluationMethod,
  type ProcurementMethod,
} from '@/lib/classification/constants';
import type { DirectoryFormContext, DirectoryFormInput } from '@/lib/classification/category-directory-crud';
import {
  allowsDirectoryTreeDescription,
  isUnassignedDomainNodeKey,
  type DirectoryLevel,
} from '@/lib/classification/category-directory-tree';
import { getClassificationStore } from '@/lib/classification/storage';

const LEVEL_ORDINAL: Record<DirectoryLevel, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
};

const DEFAULT_PROCUREMENT: ProcurementMethod[] = ['open_tender'];
const DEFAULT_EVALUATION: EvaluationMethod = 'comprehensive_score';

type Props = {
  open: boolean;
  context: DirectoryFormContext | null;
  onClose: () => void;
  onSubmit: (input: DirectoryFormInput) => void;
  error?: string | null;
};

export function DirectoryNodeFormDialog({ open, context, onClose, onSubmit, error }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [procurementMethods, setProcurementMethods] = useState<ProcurementMethod[]>([
    ...DEFAULT_PROCUREMENT,
  ]);
  const [evaluationMethod, setEvaluationMethod] = useState<EvaluationMethod | ''>(
    DEFAULT_EVALUATION,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !context) return;
    setLocalError(null);

    if (context.mode === 'edit' && context.node) {
      setName(context.node.name);
      setDescription(
        allowsDirectoryTreeDescription(context.level)
          ? (context.node.description ?? '')
          : '',
      );

      if (context.level === 6 && context.node.lotId) {
        const lot = getClassificationStore().lotLevels.find((l) => l.id === context.node!.lotId);
        if (lot) {
          setName(lot.name);
          setProcurementMethods([...lot.procurementMethods]);
          setEvaluationMethod(lot.evaluationMethods[0] ?? '');
        }
      }
      return;
    }

    setName('');
    setDescription('');
    setProcurementMethods([...DEFAULT_PROCUREMENT]);
    setEvaluationMethod(DEFAULT_EVALUATION);
  }, [open, context]);

  if (!open || !context) return null;

  const level = context.level;
  const isLotLevel = level === 6;
  const showDesc = allowsDirectoryTreeDescription(level);
  const isUnassignedEdit =
    context.mode === 'edit' && !!context.node && isUnassignedDomainNodeKey(context.node.key);
  const title =
    context.mode === 'add'
      ? `新增${LEVEL_ORDINAL[level]}级目录`
      : `编辑${LEVEL_ORDINAL[level]}级目录`;
  const submitLabel = context.mode === 'add' ? '确认新增' : '确认';
  const displayError = localError ?? error;

  const toggleProcurement = (method: ProcurementMethod) => {
    setProcurementMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  };

  const handleSubmit = () => {
    const payload: DirectoryFormInput = {
      name,
      description: showDesc ? description : undefined,
    };

    if (isLotLevel) {
      if (procurementMethods.length === 0) {
        setLocalError('请至少选择一种采购方式');
        return;
      }
      if (!evaluationMethod) {
        setLocalError('请选择评审办法');
        return;
      }
      payload.procurementMethods = [...procurementMethods];
      payload.evaluationMethod = evaluationMethod;
    }

    setLocalError(null);
    onSubmit(payload);
  };

  return (
    <ModalOverlay>
      <div
        className={`${categoryUi.directoryModal} mx-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-form-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={categoryUi.directoryModalHead}>
          <h2 id="directory-form-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={categoryUi.directoryModalBody}>
          <div className={categoryUi.directoryFormItem}>
            <label className={categoryUi.directoryFormLabel}>
              <span className="text-rose-500">*</span> 目录名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="请输入目录名称"
              className={categoryUi.directoryFormInput}
              disabled={isUnassignedEdit}
            />
            <p className={categoryUi.directoryFormHint}>
              {isUnassignedEdit ? '占位节点名称不可修改' : '最多 50 个字符'}
            </p>
          </div>

          {isLotLevel ? (
            <>
              <fieldset className={categoryUi.directoryFormItem}>
                <legend className={categoryUi.directoryFormLabel}>
                  <span className="text-rose-500">*</span> 采购方式
                  <span className="ml-1 text-xs font-normal text-slate-500">（可多选）</span>
                </legend>
                <div className={categoryUi.directoryLotProcGrid}>
                  {PROCUREMENT_METHODS.map((m) => {
                    const checked = procurementMethods.includes(m);
                    return (
                      <label
                        key={m}
                        className={categoryUi.directoryLotProcOption(checked)}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProcurement(m)}
                          className="w-3.5 h-3.5 rounded border border-slate-300 accent-blue-600 shrink-0"
                        />
                        <span className="truncate">{PROCUREMENT_METHOD_LABELS[m]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className={categoryUi.directoryFormItem}>
                <label className={categoryUi.directoryFormLabel}>
                  <span className="text-rose-500">*</span> 评审办法
                  <span className="ml-1 text-xs font-normal text-slate-500">（单选）</span>
                </label>
                <FormSelect
                  value={evaluationMethod}
                  onChange={(e) =>
                    setEvaluationMethod(e.target.value as EvaluationMethod | '')
                  }
                  className={categoryUi.directoryFormInput}
                  required
                >
                  <option value="">请选择</option>
                  {EVALUATION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {EVALUATION_METHOD_LABELS[m]}
                    </option>
                  ))}
                </FormSelect>
              </div>
            </>
          ) : null}

          {showDesc ? (
            <div className={categoryUi.directoryFormItem}>
              <div className={categoryUi.directoryFormLabel}>
                <span>树形说明</span>
                <span className="block text-xs font-normal text-slate-500 mt-0.5">
                  （仅第 1、4、5 级可填写）
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="请输入该节点的树形说明，支持描述目录用途、管理范围等…"
                className={categoryUi.formTextarea}
              />
            </div>
          ) : null}

          {displayError ? <p className="text-sm text-rose-600">{displayError}</p> : null}
        </div>

        <div
          className={categoryUi.directoryModalFoot}
          style={{ padding: '16px 24px 24px' }}
        >
          <button type="button" className={categoryUi.btnSecondary} onClick={onClose}>
            取消
          </button>
          <button type="button" className={categoryUi.btnPrimary} onClick={handleSubmit}>
            {submitLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
