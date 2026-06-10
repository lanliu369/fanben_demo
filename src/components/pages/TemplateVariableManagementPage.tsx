'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import type { TemplateVariable } from '@/types';
import { getGlobalTemplateVariables, setGlobalTemplateVariables } from '@/lib/mockData';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { systemUi } from '@/lib/systemUi';
import { FormSelect } from '@/components/ui/FormSelect';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

function normalizeKey(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('{{') && t.endsWith('}}')) return t;
  return `{{${t.replace(/^\{\{|\}\}$/g, '').trim()}}}`;
}

function withoutRequired(v: TemplateVariable): TemplateVariable {
  const { required: _r, ...rest } = v;
  return rest;
}

export default function TemplateVariableManagementPage() {
  const [items, setItems] = useState<TemplateVariable[]>(() =>
    getGlobalTemplateVariables().map(withoutRequired),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formDefault, setFormDefault] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const persist = (next: TemplateVariable[]) => {
    const cleaned = next.map(withoutRequired);
    setGlobalTemplateVariables(cleaned);
    setItems(cleaned);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormKey('');
    setFormDefault('');
    setModalOpen(true);
  };

  const openEdit = (v: TemplateVariable) => {
    const clean = withoutRequired(v);
    setEditingId(clean.id);
    setFormName(clean.name);
    setFormKey(clean.key.replace(/^\{\{|\}\}$/g, ''));
    setFormDefault(clean.defaultValue ?? '');
    setModalOpen(true);
  };

  const handleSave = () => {
    const name = formName.trim();
    const key = normalizeKey(formKey.trim() ? formKey : name);
    if (!name || !key) return;

    if (editingId) {
      persist(
        items.map((x) =>
          x.id === editingId
            ? {
                ...withoutRequired(x),
                name,
                key,
                defaultValue: formDefault.trim() || undefined,
                scope: 'global' as const,
              }
            : x,
        ),
      );
    } else {
      const exists = items.some((x) => x.key === key);
      if (exists) return;
      const nv: TemplateVariable = {
        id: `gv-${Date.now()}`,
        name,
        key,
        defaultValue: formDefault.trim() || undefined,
        scope: 'global',
      };
      persist([...items, nv]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    persist(items.filter((x) => x.id !== deleteId));
    setDeleteId(null);
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const pageStartLabel = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEndLabel = Math.min(currentPage * pageSize, sorted.length);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={systemUi.pageDesc}>
            维护范本编制页变量库中的「通用型」公共变量，保存后与范本编辑器实时同源；占位符键名为{' '}
            <code className="text-slate-600">{`{{变量名}}`}</code> 格式。
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          新增公共变量
        </button>
      </div>

      <div className={`flex-1 min-h-0 ${systemUi.card} flex flex-col`}>
        <div className="overflow-auto flex-1 min-h-0">
          <table className={systemUi.table}>
            <thead className="sticky top-0 z-10">
              <tr className={systemUi.tableHeadRow}>
                <th className={systemUi.tableTh}>变量名称</th>
                <th className={systemUi.tableTh}>占位符</th>
                <th className={systemUi.tableTh}>示例值</th>
                <th className={`${systemUi.tableThRight} w-28`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className={systemUi.tableEmpty}>
                    暂无公共变量，请点击右上角新增。
                  </td>
                </tr>
              ) : (
                pagedRows.map((v) => (
                  <tr key={v.id} className={systemUi.tableRow}>
                    <td className={systemUi.tableTd}>
                      <div className={systemUi.tableCellTitle}>{v.name}</div>
                    </td>
                    <td className={systemUi.tableTd}>
                      <div className={`${systemUi.tableCellSub} font-mono`}>{v.key}</div>
                    </td>
                    <td className={systemUi.tableTd}>
                      <div className={systemUi.tableCellSub}>{v.defaultValue ?? '—'}</div>
                    </td>
                    <td className={`${systemUi.tableTd} text-right`}>
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        className="inline-flex items-center justify-center p-1.5 rounded text-slate-500 hover:bg-slate-100"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(v.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded text-slate-500 hover:bg-rose-50 hover:text-rose-600 ml-0.5"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 && (
          <div className={systemUi.tableFooter}>
            <div className="text-xs text-slate-500">
              显示第 {pageStartLabel}-{pageEndLabel} 条，共 {sorted.length} 条
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>每页</span>
                <FormSelect
                  selectSize="xs"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  wrapperClassName="w-auto"
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
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="px-2 text-xs text-slate-600 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <ModalOverlay>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="text-sm font-semibold text-slate-900">
              {editingId ? '编辑公共变量' : '新增公共变量'}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">变量名称</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="例如：项目名称"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">占位标识（可不含括号）</label>
                <input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="项目名称 或 {{项目名称}}"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">示例值</label>
                <input
                  value={formDefault}
                  onChange={(e) => setFormDefault(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="招标文件填写时的占位示例"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formName.trim()}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <SystemDialog
        open={deleteId !== null}
        title="确认删除"
        message="确定从公共变量库中删除该变量吗？已插入范本中的占位符不会自动删除。"
        tone="danger"
        variant="confirm"
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
