'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
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
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const LIST_PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

export function CategoryFileUploadModal({ open, onClose, onUploaded, onDeleted }: Props) {
  const [entries, setEntries] = useState<CategoryFileUpload[]>(() => listCategoryFileUploads());
  const [name, setName] = useState('');
  const [version, setVersion] = useState('V1.0');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryFileUpload | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<number>(LIST_PAGE_SIZE_OPTIONS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listTotalPages = Math.max(1, Math.ceil(entries.length / listPageSize));
  const safeListPage = Math.min(listPage, listTotalPages);
  const listPageStart = (safeListPage - 1) * listPageSize;
  const pagedEntries = useMemo(
    () => entries.slice(listPageStart, listPageStart + listPageSize),
    [entries, listPageStart, listPageSize],
  );
  const listPageEndLabel = Math.min(listPageStart + listPageSize, entries.length);

  const refresh = useCallback(() => {
    setEntries(listCategoryFileUploads());
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setListPage(1);
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
    setVersion('V1.0');
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

  return (
    <>
      <ModalOverlay onBackdropClick={onClose}>
        <div
          className={`${systemUi.modalPanel} flex flex-col max-h-[90vh] w-full`}
          style={{ maxWidth: '28rem' }}
        >
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">Excel 文件上传</h3>
              <p className="text-xs text-slate-500 mt-0.5">归档存储上传文件，支持命名、版本管理与下载</p>
            </div>
            <button type="button" onClick={onClose} className={categoryUi.actionBtn} aria-label="关闭">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-900">上传新文件</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-xs font-medium text-slate-600">文件名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如：海上风电品类目录"
                    className="w-full h-8 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 bg-white outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-xs font-medium text-slate-600">版本号</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="如：V1.0"
                    className="w-full h-8 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 bg-white outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">选择 Excel</label>
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
                  className="w-full flex items-center justify-center gap-1.5 h-10 border border-dashed border-slate-200 rounded-lg text-xs text-slate-600 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {selectedFile ? (
                    <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                  ) : (
                    <span>点击选择 .xlsx / .xls 文件</span>
                  )}
                </button>
              </div>
              {uploadError ? <p className="text-[11px] text-rose-600 leading-snug">{uploadError}</p> : null}
              <button
                type="button"
                disabled={uploading || !name.trim() || !version.trim() || !selectedFile}
                onClick={() => void handleUpload()}
                className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3" />
                {uploading ? '上传中…' : '确认上传'}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-slate-900">
                  已上传文件
                  <span className="ml-1.5 font-normal text-slate-500">共 {entries.length} 个</span>
                </p>
              </div>
              {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 bg-white">
                  <FileSpreadsheet className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
                  暂无上传记录
                </div>
              ) : (
                <>
                  <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                    {pagedEntries.map((entry) => (
                      <li key={entry.id} className="px-2.5 py-2 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <p className="text-xs font-medium text-slate-900 truncate">{entry.name}</p>
                              <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                                {entry.version}
                              </span>
                            </div>
                            <p
                              className="text-[11px] text-slate-500 truncate mt-0.5"
                              title={`${entry.originalFileName} · ${entry.uploadedBy} · ${formatUploadTime(entry.uploadedAt)}`}
                            >
                              {formatCategoryFileSize(entry.fileSize)}
                              <span className="mx-1">·</span>
                              {entry.originalFileName}
                              <span className="mx-1">·</span>
                              {entry.uploadedBy}
                              <span className="mx-1">·</span>
                              {formatUploadTime(entry.uploadedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              title="下载"
                              disabled={downloadingId === entry.id}
                              onClick={() => void handleDownload(entry)}
                              className={categoryUi.actionBtn}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="删除"
                              onClick={() => setDeleteTarget(entry)}
                              className={`${categoryUi.actionBtn} hover:text-rose-600 hover:bg-rose-50`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {entries.length > 0
                        ? `${listPageStart + 1}-${listPageEndLabel} / 共 ${entries.length} 条`
                        : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-slate-600">
                        <span>每页</span>
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
                              {size}
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setListPage((p) => Math.max(1, p - 1))}
                          disabled={safeListPage <= 1}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          上一页
                        </button>
                        <span className="px-1 text-[11px] text-slate-600 tabular-nums min-w-[2.5rem] text-center">
                          {safeListPage}/{listTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                          disabled={safeListPage >= listTotalPages}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
