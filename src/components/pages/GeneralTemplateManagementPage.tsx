'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Edit2, FileText, Plus, Trash2, Upload, X, Copy } from 'lucide-react';
import type { GeneralTemplate } from '@/types';
import { getClassificationStore } from '@/lib/classification';
import { useAppShell } from '@/contexts/AppShellContext';
import { GeneralTemplateEditor } from '@/components/editor/GeneralTemplateEditor';
import { TemplateAiSearchPanel } from '@/components/templates/TemplateListQueryPanels';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { TypedConfirmDeleteDialog } from '@/components/ui/TypedConfirmDeleteDialog';
import { FormSelect } from '@/components/ui/FormSelect';
import { useGlobalLoading } from '@/components/ui/GlobalLoading';
import { systemUi } from '@/lib/systemUi';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import {
  buildAiMatchGroups,
  lotMetaFromGeneralTemplate,
  scoreGeneralTemplateItem,
  type TemplateListAiMatchGroup,
} from '@/lib/templateListQuery';
import {
  buildGeneralTemplateDownloadName,
  deleteGeneralTemplate,
  getGeneralTemplateBlob,
  getGeneralTemplateParsedContent,
  isGeneralTemplateDocFile,
  listGeneralTemplates,
  saveGeneralTemplate,
  duplicateGeneralTemplate,
} from '@/lib/general-templates';
import {
  countGeneralTemplateResources,
  countGeneralTemplateVariables,
} from '@/lib/generalTemplateStats';
import { getMockTemplates } from '@/lib/mockData';
import { collectTemplateIdsUsingGeneralTemplate } from '@/lib/generalTemplateSync';

const GENERAL_TEMPLATE_DELETE_PHRASE = '我确认删除此模版';

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function GeneralTemplateManagementPage() {
  const globalLoading = useGlobalLoading();
  const { setImmersive } = useAppShell();
  const classificationStore = useMemo(() => getClassificationStore(), []);
  const [items, setItems] = useState<GeneralTemplate[]>(() => listGeneralTemplates());
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiMatchedIds, setAiMatchedIds] = useState<Set<string> | null>(null);
  const [aiMatchGroups, setAiMatchGroups] = useState<TemplateListAiMatchGroup[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GeneralTemplate | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<GeneralTemplate | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dragOver, setDragOver] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GeneralTemplate | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<GeneralTemplate | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupDescription, setDupDescription] = useState('');
  const [dupSaving, setDupSaving] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setItems(listGeneralTemplates());
  }, []);

  const listStats = useMemo(() => {
    const templateRefCount = new Map<string, number>();
    for (const tpl of getMockTemplates()) {
      if (tpl.deletedAt || !tpl.generalTemplateId) continue;
      const gtId = tpl.generalTemplateId;
      templateRefCount.set(gtId, (templateRefCount.get(gtId) ?? 0) + 1);
    }

    const stats = new Map<string, { variableCount: number; resourceCount: number; templateRefCount: number }>();
    for (const item of items) {
      let variableCount = item.variableCount;
      let resourceCount = item.resourceCount;
      if (variableCount == null || resourceCount == null) {
        const parsed = getGeneralTemplateParsedContent(item.id);
        if (parsed) {
          if (variableCount == null) variableCount = countGeneralTemplateVariables(parsed);
          if (resourceCount == null) resourceCount = countGeneralTemplateResources(parsed);
        }
      }
      stats.set(item.id, {
        variableCount: variableCount ?? 0,
        resourceCount: resourceCount ?? 0,
        templateRefCount: templateRefCount.get(item.id) ?? 0,
      });
    }
    return stats;
  }, [items]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setImmersive(!!editingEntry);
    return () => setImmersive(false);
  }, [editingEntry, setImmersive]);

  const displayedItems = useMemo(() => {
    let result = items;
    if (aiMatchedIds !== null) {
      result = result.filter((item) => aiMatchedIds.has(item.id));
    }
    return sortByCreatedAtDesc(result);
  }, [items, aiMatchedIds]);

  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedRows = useMemo(
    () => displayedItems.slice(pageStart, pageStart + pageSize),
    [displayedItems, pageStart, pageSize],
  );
  const pageStartLabel = displayedItems.length === 0 ? 0 : pageStart + 1;
  const pageEndLabel = Math.min(pageStart + pageSize, displayedItems.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [aiMatchedIds, pageSize]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) {
      setAiMatchedIds(null);
      setAiMatchGroups(null);
      return;
    }
    setAiSearching(true);
    try {
      await globalLoading.wrap(async () => {
        await new Promise((r) => setTimeout(r, 800));
        const queryTokens = aiQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matchedItems = items.filter(
          (item) => scoreGeneralTemplateItem(aiQuery, item, classificationStore) > 0,
        );
        setAiMatchedIds(new Set(matchedItems.map((item) => item.id)));
        setAiMatchGroups(
          buildAiMatchGroups(
            matchedItems,
            (item) => lotMetaFromGeneralTemplate(item, classificationStore),
            queryTokens,
          ),
        );
      }, '正在加载中…');
    } finally {
      setAiSearching(false);
    }
  };

  const clearAiSearch = () => {
    setAiQuery('');
    setAiMatchedIds(null);
    setAiMatchGroups(null);
  };

  const applyAiMatchGroup = (_group: TemplateListAiMatchGroup) => {
    setTimeout(() => {
      const listEl = document.getElementById('general-template-list-anchor');
      listEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const openCreate = () => {
    setFormName('');
    setFormDescription('');
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setModalOpen(true);
  };

  const handlePickFile = (file: File | undefined) => {
    if (!file) return;
    if (!isGeneralTemplateDocFile(file)) {
      setUploadError('仅支持 Word 模版（.doc / .docx）');
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    if (!formName.trim()) {
      const base = file.name.replace(/\.[^.]+$/i, '').trim();
      setFormName(base);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setUploadError('请填写模版名称');
      return;
    }
    if (!selectedFile) {
      setUploadError('请上传模版文件');
      return;
    }
    setSaving(true);
    setUploadError(null);
    try {
      await saveGeneralTemplate({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        file: selectedFile,
      });
      refresh();
      setModalOpen(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (entry: GeneralTemplate) => {
    setDownloadingId(entry.id);
    try {
      const blob = await getGeneralTemplateBlob(entry.id);
      if (!blob) {
        setUploadError('文件不存在或已被清除');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildGeneralTemplateDownloadName(entry);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setUploadError('下载失败，请重试');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const linkedIds = collectTemplateIdsUsingGeneralTemplate(deleteTarget.id, getMockTemplates());
    if (linkedIds.length > 0) {
      setDeleteTarget(null);
      setDeleteBlocked(deleteTarget);
      return;
    }
    await deleteGeneralTemplate(deleteTarget.id);
    refresh();
    setDeleteTarget(null);
  };

  const tryDelete = (entry: GeneralTemplate) => {
    const linkedCount = listStats.get(entry.id)?.templateRefCount ?? 0;
    if (linkedCount > 0) {
      setDeleteBlocked(entry);
      return;
    }
    setDeleteTarget(entry);
  };

  const openDuplicate = (entry: GeneralTemplate) => {
    setDuplicateSource(entry);
    setDupName(`${entry.name.trim()}（副本）`);
    setDupDescription(entry.description ?? '');
    setDupError(null);
  };

  const closeDuplicate = () => {
    if (dupSaving) return;
    setDuplicateSource(null);
    setDupName('');
    setDupDescription('');
    setDupError(null);
  };

  const handleDuplicateSave = async () => {
    if (!duplicateSource) return;
    if (!dupName.trim()) {
      setDupError('请填写模版名称');
      return;
    }
    setDupSaving(true);
    setDupError(null);
    try {
      await duplicateGeneralTemplate(duplicateSource.id, {
        name: dupName.trim(),
        description: dupDescription.trim() || undefined,
      });
      refresh();
      setDuplicateSource(null);
      setDupName('');
      setDupDescription('');
      setDupError(null);
    } catch (e) {
      setDupError(e instanceof Error ? e.message : '复制失败，请重试');
    } finally {
      setDupSaving(false);
    }
  };

  const canSave = Boolean(formName.trim() && selectedFile && !saving);
  const canDuplicateSave = Boolean(duplicateSource && dupName.trim() && !dupSaving);

  if (editingEntry) {
    return (
      <GeneralTemplateEditor
        entry={editingEntry}
        onBack={() => setEditingEntry(null)}
        onUpdated={() => {
          refresh();
          setEditingEntry((prev) => {
            if (!prev) return null;
            return listGeneralTemplates().find((g) => g.id === prev.id) ?? prev;
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className={systemUi.pageDesc}>管理通用模版，上传 Word 文件后自动解析大纲与段落正文</p>

      {uploadError && !modalOpen ? (
        <p className="text-xs text-rose-600 px-1">{uploadError}</p>
      ) : null}

      <TemplateAiSearchPanel
        placeholder="用自然语言描述您需要的通用模版，例如：储能EPC资格要求 Word 模版..."
        itemLabel="模版"
        query={aiQuery}
        searching={aiSearching}
        matchGroups={aiMatchGroups}
        matchedCount={aiMatchedIds?.size ?? 0}
        selectedLotLevelId=""
        onQueryChange={setAiQuery}
        onSearch={() => void handleAiSearch()}
        onClear={clearAiSearch}
        onApplyGroup={applyAiMatchGroup}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加模版
        </button>
      </div>

      <div id="general-template-list-anchor" className={systemUi.card}>
        <table className={`${systemUi.table} table-fixed`}>
          <thead className="sticky top-0 z-10">
            <tr className={systemUi.tableHeadRow}>
              <th className={`${systemUi.tableTh} w-[16%]`}>模版名称</th>
              <th className={`${systemUi.tableTh} w-[20%]`}>模版描述</th>
              <th className={`${systemUi.tableTh} w-[11%]`}>通用变量</th>
              <th className={`${systemUi.tableTh} w-[11%]`}>专用资源</th>
              <th className={`${systemUi.tableTh} w-[11%]`}>引用次数</th>
              <th className={`${systemUi.tableTh} w-[16%]`}>更新时间</th>
              <th className={`${systemUi.tableTh} w-[15%]`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className={systemUi.tableEmpty}>
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>暂无通用模版，点击「添加模版」创建</p>
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                const stats = listStats.get(row.id) ?? { variableCount: 0, resourceCount: 0, templateRefCount: 0 };
                return (
                <tr
                  key={row.id}
                  className={`${systemUi.tableRow} ${
                    aiMatchedIds?.has(row.id) ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : ''
                  }`}
                >
                  <td className={systemUi.tableTd}>
                    <div className="text-sm font-medium text-slate-900 truncate">{row.name}</div>
                  </td>
                  <td className={`${systemUi.tableTd} text-xs text-slate-600`}>
                    {row.description?.trim() ? (
                      <span className="line-clamp-2" title={row.description}>
                        {row.description}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={`${systemUi.tableTd} text-xs text-slate-600 tabular-nums`}>
                    {stats.variableCount}
                  </td>
                  <td className={`${systemUi.tableTd} text-xs text-slate-600 tabular-nums`}>
                    {stats.resourceCount}
                  </td>
                  <td className={`${systemUi.tableTd} text-xs text-slate-600 tabular-nums`}>
                    {stats.templateRefCount}
                  </td>
                  <td className={`${systemUi.tableTd} text-xs text-slate-500 whitespace-nowrap tabular-nums`}>
                    {formatDateTime(row.updatedAt)}
                  </td>
                  <td className={systemUi.tableTd}>
                    <div className="flex items-center justify-start gap-1">
                      <button
                        type="button"
                        title="编辑"
                        onClick={() => setEditingEntry(row)}
                        className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="复制"
                        onClick={() => openDuplicate(row)}
                        className="p-1.5 rounded hover:bg-violet-50 text-slate-500 hover:text-violet-600 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="下载"
                        disabled={downloadingId === row.id}
                        onClick={() => void handleDownload(row)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="删除"
                        onClick={() => tryDelete(row)}
                        className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className={systemUi.tableFooter}>
          <div className="text-xs text-slate-500">
            显示第 {pageStartLabel}-{pageEndLabel} 条，共 {displayedItems.length} 条
          </div>
          <div className="flex items-center gap-3">
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
                disabled={safePage <= 1}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-2 text-xs text-slate-600 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ModalOverlay onBackdropClick={() => !saving && setModalOpen(false)}>
          <div
            className={`${systemUi.modalPanel} flex flex-col max-h-[90vh]`}
            style={{ width: '56rem', maxWidth: 'calc(100vw - 2rem)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">添加通用模版</h3>
                <p className="text-xs text-slate-500 mt-0.5">填写名称与描述并上传 Word 模版；系统将自动解析大纲与段落正文</p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  模版名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="请输入模版名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">模版描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="请输入模版描述"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  模版文件 <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => handlePickFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handlePickFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg text-left transition-colors ${
                    dragOver
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20'
                  }`}
                >
                  <Upload className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-slate-700 truncate block">
                      {selectedFile ? selectedFile.name : '点击或拖拽上传 Word 模版'}
                    </span>
                    <span className="text-xs text-slate-400">支持 .doc、.docx</span>
                  </div>
                </button>
              </div>

              {uploadError ? <p className="text-xs text-rose-600">{uploadError}</p> : null}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => void handleSave()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中…' : '确认添加'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {duplicateSource && (
        <ModalOverlay onBackdropClick={() => !dupSaving && closeDuplicate()}>
          <div
            className={`${systemUi.modalPanel} flex flex-col max-h-[90vh]`}
            style={{ width: '40rem', maxWidth: 'calc(100vw - 2rem)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">复制通用模版</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  将复制「{duplicateSource.name}」的文件与解析内容；请确认新模版名称与描述后保存
                </p>
              </div>
              <button
                type="button"
                onClick={() => !dupSaving && closeDuplicate()}
                className="text-slate-400 hover:text-slate-600"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  模版名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  placeholder="请输入新模版名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">模版描述</label>
                <textarea
                  value={dupDescription}
                  onChange={(e) => setDupDescription(e.target.value)}
                  placeholder="请输入模版描述"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <span className="font-medium text-slate-700">源文件：</span>
                {duplicateSource.originalFileName}
                <span className="text-slate-400 mx-1">·</span>
                {duplicateSource.paragraphCount ?? 0} 段 /
                {duplicateSource.outlineSectionCount ?? 0} 章
              </div>

              {dupError ? <p className="text-xs text-rose-600">{dupError}</p> : null}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                disabled={dupSaving}
                onClick={closeDuplicate}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!canDuplicateSave}
                onClick={() => void handleDuplicateSave()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dupSaving ? '生成中…' : '确认生成'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <TypedConfirmDeleteDialog
        open={deleteTarget !== null}
        title="删除通用模版"
        message={
          deleteTarget
            ? `确定删除「${deleteTarget.name}」？删除后不可恢复，且与源文件、解析内容一并清除。`
            : ''
        }
        confirmPhrase={GENERAL_TEMPLATE_DELETE_PHRASE}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />

      <SystemDialog
        open={deleteBlocked !== null}
        title="无法删除"
        message={
          deleteBlocked
            ? `「${deleteBlocked.name}」仍被 ${
                listStats.get(deleteBlocked.id)?.templateRefCount ?? 0
              } 个范本引用。请先解除范本关联或删除相关范本后再试。`
            : ''
        }
        tone="warning"
        onConfirm={() => setDeleteBlocked(null)}
        onClose={() => setDeleteBlocked(null)}
      />
    </div>
  );
}
