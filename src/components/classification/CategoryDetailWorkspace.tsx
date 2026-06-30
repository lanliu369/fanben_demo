'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Inbox, Pencil, Trash2 } from 'lucide-react';
import type { LotLevel } from '@/types';
import { categoryUi } from '@/components/classification/category-ui';
import { CategoryDropdownMenu } from '@/components/classification/CategoryDropdownMenu';
import {
  formatEvaluationMethods,
  formatProcurementMethods,
} from '@/lib/classification/constants';
import {
  descriptionTargetFromDetail,
  detailTitle,
  type CategoryDetailContext,
} from '@/lib/classification/nav-detail';
import { patchClassificationNodeDescription } from '@/lib/classification/crud';
import { getMockActor } from '@/lib/dataAudit';
import { SectionCard } from '@/components/ui/SectionCard';
import { HintPanel, CategoryEmptyIcon } from '@/components/ui/HintPanel';

type Props = {
  detail: CategoryDetailContext;
  onEditLot: (lot: LotLevel) => void;
  onDeleteLot: (lot: LotLevel) => void;
  onSelectLot: (lotId: string) => void;
  onDescriptionSaved: () => void;
  onViewOperationLog?: () => void;
};

function InfoGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className={categoryUi.descLabel}>{item.label}</dt>
          <dd className={categoryUi.descValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DescriptionBlock({
  title,
  description,
  editable,
  onSave,
}: {
  title: string;
  description?: string;
  editable: boolean;
  onSave: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => !!description?.trim());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? '');
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    setDraft(description ?? '');
    setEditing(false);
    if (!description?.trim()) setExpanded(false);
  }, [description]);

  const text = description?.trim();

  const showBody = expanded || editing;

  return (
    <div
      className={`${categoryUi.descCard} ${
        showBody ? 'px-4 py-3' : 'px-4 py-2'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 min-h-[28px] ${
          showBody ? 'mb-2.5' : ''
        }`}
      >
        <p className={categoryUi.moduleTitle}>{title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {savedHint && <span className="text-xs text-blue-600">已保存</span>}
          {editable && !editing && (
            <button
              type="button"
              className="inline-flex items-center gap-1 h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              onClick={() => {
                setExpanded(true);
                setEditing(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              编辑
            </button>
          )}
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? '收起' : '展开'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <>
          {editing ? (
            <div className="space-y-2 max-w-2xl">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className={categoryUi.formTextarea}
                placeholder="填写分类业务说明，便于导航与 AI 理解"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={categoryUi.btnPrimary}
                  onClick={() => {
                    onSave(draft);
                    setEditing(false);
                    setSavedHint(true);
                    setTimeout(() => setSavedHint(false), 2000);
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  className={categoryUi.btnSecondary}
                  onClick={() => {
                    setDraft(description ?? '');
                    setEditing(false);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : text ? (
            <p className="text-sm leading-relaxed text-slate-600 max-w-2xl whitespace-pre-wrap">
              {text}
            </p>
          ) : (
            <p className="text-sm text-slate-500">暂无说明，点击编辑补充分类业务解释。</p>
          )}
        </>
      )}
    </div>
  );
}

export function CategoryDetailWorkspace({
  detail,
  onEditLot,
  onDeleteLot,
  onSelectLot,
  onDescriptionSaved,
  onViewOperationLog,
}: Props) {
  if (detail.kind === 'empty') {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        <div className="w-full max-w-lg">
          <HintPanel
            icon={<CategoryEmptyIcon />}
            title="请选择分类节点"
            description="在左侧导航中点击业务板块、业务类型或品类，右侧将展示基础信息与分类说明。"
            meta="支持在树形模式下查看详情，或切换列表模式批量浏览"
          />
        </div>
      </div>
    );
  }

  const title = detailTitle(detail);
  const descTarget = descriptionTargetFromDetail(detail);

  const getDescription = (): string | undefined => {
    if (detail.kind === 'sector') return detail.sector.description;
    if (detail.kind === 'businessType') return detail.businessType.description;
    if (detail.kind === 'domain') return detail.domain.description;
    return undefined;
  };

  const handleSaveDescription = (text: string) => {
    if (!descTarget) return;
    if (patchClassificationNodeDescription(descTarget, text)) {
      onDescriptionSaved();
    }
  };

  const realSubtitle =
    detail.kind === 'lot'
      ? detail.path
      : detail.kind === 'sector'
        ? '业务板块'
        : detail.kind === 'businessType'
          ? `${detail.sector.name} / ${detail.businessType.displayName}`
          : detail.kind === 'domain'
            ? `${detail.sector.name} / ${detail.businessType.displayName} / ${detail.domain.name}`
            : detail.kind === 'unassigned'
              ? `${detail.sector.name} / ${detail.businessType.displayName}`
              : '';

  const headerActions =
    detail.kind === 'lot' ? (
      <div className="flex items-center gap-2 shrink-0 overflow-visible">
        <button type="button" className={categoryUi.btnPrimary} onClick={() => onEditLot(detail.lot)}>
          编辑
        </button>
        <button
          type="button"
          className={categoryUi.btnDangerOutline}
          onClick={() => onDeleteLot(detail.lot)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
        {onViewOperationLog ? (
          <CategoryDropdownMenu
            trigger={
              <button type="button" className={categoryUi.btnSecondary}>
                更多
              </button>
            }
            items={[{ label: '查看操作日志', onClick: onViewOperationLog }]}
          />
        ) : null}
      </div>
    ) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={categoryUi.detailHeader}>
        <div className="flex items-start justify-between gap-4 overflow-visible">
          <div className="min-w-0">
            <p className={`${categoryUi.detailTitle} truncate`}>{title}</p>
            <p className={`${categoryUi.hint} mt-1 truncate`}>{realSubtitle}</p>
          </div>
          {headerActions}
        </div>
      </div>

      <div className={categoryUi.detailBody}>
        {detail.kind === 'lot' && (
          <SectionCard title="基础信息" bodyClassName="p-6">
            <InfoGrid
              items={[
                {
                  label: '采购方式',
                  value: formatProcurementMethods(detail.lot.procurementMethods),
                },
                {
                  label: '评审办法',
                  value: formatEvaluationMethods(detail.lot.evaluationMethods),
                },
                {
                  label: '系统/专业/阶段',
                  value: detail.pathFull?.domainLevelName ?? '无',
                },
                { label: '更新时间', value: detail.lot.updatedAt },
                { label: '创建时间', value: detail.lot.createdAt },
                { label: '维护人', value: getMockActor() },
              ]}
            />
          </SectionCard>
        )}

        {descTarget && (
          <DescriptionBlock
            title="分类说明"
            description={getDescription()}
            editable
            onSave={handleSaveDescription}
          />
        )}

        {detail.kind !== 'lot' && detail.childLots.length > 0 && (
          <SectionCard
            title="下属品类"
            titleExtra={
              <span className="text-xs font-normal text-slate-500">
                {detail.childLots.length} 项
              </span>
            }
            bodyClassName="p-4 space-y-2"
          >
            <ul className="space-y-2">
              {detail.childLots.map((lot) => (
                <li key={lot.id}>
                  <button
                    type="button"
                    className={`${categoryUi.childLotItem} w-full text-left`}
                    onClick={() => onSelectLot(lot.id)}
                  >
                    <span className="font-medium text-slate-900">{lot.name}</span>
                    <span className="text-xs text-slate-500">{lot.updatedAt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {detail.kind !== 'lot' && detail.childLots.length === 0 && (
          <SectionCard title="下属品类" bodyClassName="p-4">
            <HintPanel
              tone="info"
              icon={<Inbox className="w-5 h-5 text-slate-500" />}
              title="当前节点下暂无品类"
              description="可在工具栏点击「新增品类」创建数据，或通过批量上传导入 Excel。"
              meta="切换列表模式可查看全部品类并筛选"
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
