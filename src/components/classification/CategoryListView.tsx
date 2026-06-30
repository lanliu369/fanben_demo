'use client';

import { MoreHorizontal } from 'lucide-react';
import type { LotLevel } from '@/types';
import { HighlightText } from '@/components/classification/HighlightText';
import { categoryUi } from '@/components/classification/category-ui';
import { FormSelect } from '@/components/ui/FormSelect';
import { CategoryDropdownMenu } from '@/components/classification/CategoryDropdownMenu';
import {
  formatEvaluationMethods,
  formatProcurementMethods,
} from '@/lib/classification/constants';

type Row = {
  lot: LotLevel;
  businessPath: string;
  businessPathTitle?: string;
  procurementMethods: LotLevel['procurementMethods'];
  evaluationMethods: LotLevel['evaluationMethods'];
  searchQuery?: string;
};

type Props = {
  rows: Row[];
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (lot: LotLevel) => void;
  onDelete: (lot: LotLevel) => void;
};

function ActionDropdown({
  lot,
  onEdit,
  onDelete,
}: {
  lot: LotLevel;
  onEdit: (lot: LotLevel) => void;
  onDelete: (lot: LotLevel) => void;
}) {
  return (
    <CategoryDropdownMenu
      trigger={
        <button type="button" className={categoryUi.actionBtn} title="更多操作">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      }
      items={[
        { label: '编辑', onClick: () => onEdit(lot) },
        { label: '删除', onClick: () => onDelete(lot), danger: true },
      ]}
    />
  );
}

export function CategoryListView({
  rows,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + pageSize);
  const pageStartLabel = rows.length === 0 ? 0 : pageStart + 1;
  const pageEndLabel = Math.min(pageStart + pageSize, rows.length);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="flex-1 overflow-auto">
        <table className={categoryUi.table}>
          <thead className={categoryUi.tableHead}>
            <tr className={categoryUi.tableHeadRow}>
              <th className={`${categoryUi.tableTh} w-[15%]`}>品类级别</th>
              <th className={`${categoryUi.tableTh} w-[36%]`}>所属业务路径</th>
              <th className={`${categoryUi.tableTh} w-[14%]`}>采购方式</th>
              <th className={`${categoryUi.tableTh} w-[14%]`}>评审办法</th>
              <th className={`${categoryUi.tableTh} w-[12%]`}>更新时间</th>
              <th className={`${categoryUi.tableThRight} w-[9%]`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={categoryUi.tableEmpty}>
                  暂无品类数据
                </td>
              </tr>
            ) : (
              pagedRows.map(
                ({
                  lot,
                  businessPath,
                  businessPathTitle,
                  procurementMethods,
                  evaluationMethods,
                  searchQuery: rowQuery,
                }) => (
                  <tr key={lot.id} className={categoryUi.tableRow}>
                    <td className={categoryUi.tableTd}>
                      <div className={categoryUi.tableCellTitle}>
                        <HighlightText text={lot.name} query={rowQuery} />
                      </div>
                    </td>
                    <td className={categoryUi.tableTd} title={businessPathTitle}>
                      <div className={`${categoryUi.tableCellSub} line-clamp-2`}>
                        <HighlightText text={businessPath} query={rowQuery} />
                      </div>
                    </td>
                    <td className={categoryUi.tableTd}>
                      {formatProcurementMethods(procurementMethods)}
                    </td>
                    <td className={categoryUi.tableTd}>
                      {formatEvaluationMethods(evaluationMethods)}
                    </td>
                    <td className={`${categoryUi.tableTdMuted} tabular-nums whitespace-nowrap`}>
                      {lot.updatedAt}
                    </td>
                    <td className={`${categoryUi.tableTd} text-right`}>
                      <ActionDropdown lot={lot} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <div className={categoryUi.tableFooter}>
        <span>
          共 {rows.length} 条
          {rows.length > 0 && (
            <span>
              ，显示 {pageStartLabel}–{pageEndLabel}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span>每页</span>
            <FormSelect
              selectSize="xs"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              wrapperClassName="w-[4.5rem]"
            >
              {[10, 20, 50].map((size) => (
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
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className={`${categoryUi.btnSecondary} h-7 px-2 text-xs disabled:opacity-40`}
            >
              上一页
            </button>
            <span className="px-2 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className={`${categoryUi.btnSecondary} h-7 px-2 text-xs disabled:opacity-40`}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
