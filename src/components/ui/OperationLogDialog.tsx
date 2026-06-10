'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DataAuditEntry } from '@/types';
import { formatAuditAction, formatAuditAt } from '@/lib/dataAudit';
import { systemUi } from '@/lib/systemUi';
import { FormSelect } from '@/components/ui/FormSelect';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

type OperationLogDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  entries: DataAuditEntry[];
  emptyHint?: string;
};

export function OperationLogDialog({
  open,
  onClose,
  title,
  entries,
  emptyHint = '暂无记录',
}: OperationLogDialogProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  }, [open]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const { pagedEntries, pageStartLabel, pageEndLabel } = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const slice = entries.slice(start, start + pageSize);
    const startLabel = total === 0 ? 0 : start + 1;
    const endLabel = Math.min(start + pageSize, total);
    return { pagedEntries: slice, pageStartLabel: startLabel, pageEndLabel: endLabel };
  }, [entries, safePage, pageSize, total]);

  if (!open) return null;

  return (
    <ModalOverlay zClassName="z-[110]" onBackdropClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="operation-log-title"
        className="flex max-h-[min(85vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="operation-log-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">{emptyHint}</div>
          ) : (
            <table className={systemUi.table}>
              <thead className="sticky top-0 z-10">
                <tr className={systemUi.tableHeadRow}>
                  <th className={systemUi.tableTh}>时间</th>
                  <th className={systemUi.tableTh}>操作人</th>
                  <th className={systemUi.tableTh}>操作类型</th>
                  <th className={systemUi.tableTh}>说明</th>
                </tr>
              </thead>
              <tbody>
                {pagedEntries.map((row) => (
                  <tr key={row.id} className={systemUi.tableRow}>
                    <td className={`${systemUi.tableTdMuted} whitespace-nowrap tabular-nums`}>
                      {formatAuditAt(row.at)}
                    </td>
                    <td className={`${systemUi.tableTd} whitespace-nowrap`}>{row.actor}</td>
                    <td className={`${systemUi.tableTd} whitespace-nowrap`}>
                      {formatAuditAction(row.action)}
                    </td>
                    <td className={systemUi.tableTdMuted}>
                      <span className="break-words">
                        {[row.label, row.detail].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                显示第 {pageStartLabel}-{pageEndLabel} 条，共 {total} 条
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>每页</span>
                  <FormSelect
                    selectSize="xs"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    wrapperClassName="w-auto"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </FormSelect>
                  <span>条</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="px-2 text-xs text-slate-600 tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
