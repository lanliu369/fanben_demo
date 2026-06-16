'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import type { CategoryFileUpload } from '@/types';
import { categoryUi } from '@/components/classification/category-ui';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { FormSelect } from '@/components/ui/FormSelect';
import { TypedConfirmDeleteDialog } from '@/components/ui/TypedConfirmDeleteDialog';
import { systemUi } from '@/lib/systemUi';
import {
  buildCategoryFileDownloadName,
  formatCategoryFileSize,
  getCategoryFileUploadBlob,
  isCategoryExcelFile,
  listCategoryFileUploads,
  saveCategoryFileUpload,
  deleteCategoryFileUpload,
} from '@/lib/classification/category-file-uploads';

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded?: (entry: CategoryFileUpload) => void;
  onDeleted?: (entry: CategoryFileUpload) => void;
};

function formatUploadTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function CategoryFileUploadModal({ open, onClose, onUploaded, onDeleted }: Props) {
  const [entries, setEntries] = useState<CategoryFileUpload[]>(() => listCategoryFileUploads());
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryFileUpload | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<number>(LIST_PAGE_SIZE_OPTIONS[0]);
  const [gotoPageInput, setGotoPageInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listTotalPages = Math.max(1, Math.ceil(entries.length / listPageSize));
  const safeListPage = Math.min(listPage, listTotalPages);
  const listPageStart = (safeListPage - 1) * listPageSize;
  const pagedEntries = useMemo(
    () => entries.slice(listPageStart, listPageStart + listPageSize),
    [entries, listPageStart, listPageSize],
  );

  const refresh = useCallback(() => {
    setEntries(listCategoryFileUploads());
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setListPage(1);
      setGotoPageInput('');
    }
  }, [open, refresh]);

  useEffect(() => {
    if (listPage > listTotalPages) {
      setListPage(listTotalPages);
    }
  }, [listPage, listTotalPages]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setVersion('');
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickFile = (file: File | undefined) => {
    if (!file) return;
    if (!isCategoryExcelFile(file)) {
      setUploadError('仅支持 Excel 文件（.xlsx / .xls）');
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    if (!name.trim()) {
      const base = file.name.replace(/\.(xlsx|xls)$/i, '');
      setName(base);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('请选择 Excel 文件');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const entry = await saveCategoryFileUpload({
        name,
        version,
        file: selectedFile,
      });
      refresh();
      resetForm();
      setListPage(1);
      onUploaded?.(entry);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (entry: CategoryFileUpload) => {
    setDownloadingId(entry.id);
    try {
      const blob = await getCategoryFileUploadBlob(entry.id);
      if (!blob) {
        setUploadError('文件不存在或已被清除，请重新上传');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildCategoryFileDownloadName(entry);
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
    const ok = await deleteCategoryFileUpload(deleteTarget.id);
    if (ok) {
      onDeleted?.(deleteTarget);
      refresh();
    }
    setDeleteTarget(null);
  };

  const applyGotoPage = () => {
    const n = parseInt(gotoPageInput.trim(), 10);
    if (!Number.isFinite(n)) return;
    const target = Math.min(listTotalPages, Math.max(1, n));
    setListPage(target);
    setGotoPageInput(String(target));
  };

  return (
    <>
      <ModalOverlay onBackdropClick={onClose}>
        <div className={`${systemUi.modalPanelLg} flex flex-col max-h-[90vh] w-full`}>
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">Excel 文件上传</h3>
              <p className="text-xs text-slate-500 mt-0.5">归档存储上传文件，支持命名、版本管理与下载</p>
            </div>
            <button type="button" onClick={onClose} className={categoryUi.actionBtn} aria-label="关闭">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="text-sm font-medium text-slate-700">文件名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入文件名称"
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 bg-white outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="text-sm font-medium text-slate-700">版本号</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="请输入版本号"
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 bg-white outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">选择 Excel</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
                  className={`w-full flex flex-col items-center justify-center gap-1 min-h-[7.5rem] border-2 border-dashed rounded-lg text-sm transition-colors ${
                    dragOver
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20'
                  }`}
                >
                  <Upload className="w-8 h-8 text-slate-300" />
                  <span className="text-slate-600">
                    {selectedFile ? selectedFile.name : '点击或拖拽上传 Excel 文件'}
                  </span>
                  <span className="text-xs text-slate-400">支持 .xlsx, .xls 格式</span>
                </button>
              </div>

              {uploadError ? <p className="text-xs text-rose-600 leading-snug">{uploadError}</p> : null}

              <button
                type="button"
                disabled={uploading || !name.trim() || !version.trim() || !selectedFile}
                onClick={() => void handleUpload()}
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {uploading ? '上传中…' : '确认上传'}
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 mb-3">上传记录</p>
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                {entries.length === 0 ? (
                  <div className="py-14 text-center text-sm text-slate-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    暂无上传记录
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className={categoryUi.table}>
                        <thead className={categoryUi.tableHead}>
                          <tr className={categoryUi.tableHeadRow}>
                            <th className={`${categoryUi.tableTh} w-[28%]`}>文件名称</th>
                            <th className={`${categoryUi.tableTh} w-[10%]`}>版本号</th>
                            <th className={`${categoryUi.tableTh} w-[22%]`}>上传时间</th>
                            <th className={`${categoryUi.tableTh} w-[12%]`}>上传人</th>
                            <th className={`${categoryUi.tableTh} w-[12%]`}>文件大小</th>
                            <th className={`${categoryUi.tableThRight} w-[16%]`}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedEntries.map((entry) => (
                            <tr key={entry.id} className={categoryUi.tableRow}>
                              <td className={categoryUi.tableTd}>
                                <span className="text-sm font-medium text-slate-900 truncate block max-w-[14rem]" title={entry.name}>
                                  {entry.name}
                                </span>
                              </td>
                              <td className={categoryUi.tableTdMuted}>{entry.version}</td>
                              <td className={`${categoryUi.tableTdMuted} whitespace-nowrap tabular-nums text-xs`}>
                                {formatUploadTime(entry.uploadedAt)}
                              </td>
                              <td className={categoryUi.tableTd}>{entry.uploadedBy}</td>
                              <td className={`${categoryUi.tableTdMuted} whitespace-nowrap`}>
                                {formatCategoryFileSize(entry.fileSize)}
                              </td>
                              <td className={`${categoryUi.tableTd} text-right`}>
                                <div className="inline-flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    title="下载"
                                    disabled={downloadingId === entry.id}
                                    onClick={() => void handleDownload(entry)}
                                    className={categoryUi.actionBtn}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="删除"
                                    onClick={() => setDeleteTarget(entry)}
                                    className={`${categoryUi.actionBtn} hover:text-rose-600 hover:bg-rose-50`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={categoryUi.tableFooter}>
                      <span className="tabular-nums">共 {entries.length} 条</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setListPage((p) => Math.max(1, p - 1))}
                            disabled={safeListPage <= 1}
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="上一页"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 text-xs font-medium text-white bg-blue-600 rounded tabular-nums">
                            {safeListPage}
                          </span>
                          <button
                            type="button"
                            onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                            disabled={safeListPage >= listTotalPages}
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="下一页"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <FormSelect
                            selectSize="xs"
                            value={listPageSize}
                            onChange={(e) => {
                              setListPageSize(Number(e.target.value));
                              setListPage(1);
                            }}
                            wrapperClassName="w-auto"
                          >
                            {LIST_PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size} 条/页
                              </option>
                            ))}
                          </FormSelect>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>前往</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={gotoPageInput}
                            onChange={(e) => setGotoPageInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyGotoPage();
                            }}
                            onBlur={applyGotoPage}
                            placeholder=""
                            className="w-10 h-7 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                          />
                          <span>页</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalOverlay>

      <TypedConfirmDeleteDialog
        open={deleteTarget !== null}
        title="删除上传文件"
        message={
          deleteTarget
            ? `确定删除「${deleteTarget.name}」（${deleteTarget.version}）？删除后不可恢复。`
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
