'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { CategoryFileUpload } from '@/types';
import { categoryUi } from '@/components/classification/category-ui';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { systemUi } from '@/lib/systemUi';
import {
  buildCategoryFileDownloadName,
  formatCategoryFileSize,
  getCategoryFileUploadBlob,
  isCategoryExcelFile,
  listCategoryFileUploads,
  parseCategoryFileDisplayName,
  saveCategoryFileUpload,
} from '@/lib/classification/category-file-uploads';

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded?: (entry: CategoryFileUpload) => void;
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

const RECENT_ENTRY_LIMIT = 3;

export function CategoryFileUploadModal({ open, onClose, onUploaded }: Props) {
  const [entries, setEntries] = useState<CategoryFileUpload[]>(() => listCategoryFileUploads());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recentEntries = useMemo(() => entries.slice(0, RECENT_ENTRY_LIMIT), [entries]);

  const refresh = useCallback(() => {
    setEntries(listCategoryFileUploads());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const resetForm = () => {
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickFile = (file: File | undefined) => {
    if (!file) return;
    if (!isCategoryExcelFile(file)) {
      setUploadError('仅支持 Excel 原始文件（.xlsx / .xls）');
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('请选择原始文件');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const entry = await saveCategoryFileUpload({ file: selectedFile });
      refresh();
      resetForm();
      onUploaded?.(entry);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '更新失败，请重试');
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

  const parsedName = selectedFile ? parseCategoryFileDisplayName(selectedFile) : null;

  return (
    <ModalOverlay onBackdropClick={onClose}>
      <div className={`${systemUi.modalPanelLg} flex flex-col max-h-[90vh] w-full`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">查看原始文件</h3>
            <p className="text-xs text-slate-500 mt-0.5">查看与更新品类原始文件，支持下载</p>
          </div>
          <button type="button" onClick={onClose} className={categoryUi.actionBtn} aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <label className="text-xs font-medium text-slate-700">选择原始文件</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => handlePickFile(e.target.files?.[0])}
            />
            <div className="flex items-center gap-2">
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
                className={`flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 border border-dashed rounded-lg text-left transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20'
                }`}
              >
                <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-600 truncate block">
                    {selectedFile ? selectedFile.name : '点击或拖拽上传原始文件'}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate block">
                    {parsedName ? `文件名称：${parsedName}` : '支持 .xlsx, .xls 格式'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                disabled={uploading || !selectedFile}
                onClick={() => void handleUpload()}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? '更新中…' : '确认更新'}
              </button>
            </div>

            {uploadError ? <p className="text-xs text-rose-600 leading-snug">{uploadError}</p> : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900 mb-3">文件记录</p>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {entries.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  暂无文件记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={categoryUi.table}>
                    <thead className={categoryUi.tableHead}>
                      <tr className={categoryUi.tableHeadRow}>
                        <th className={`${categoryUi.tableTh} w-[32%]`}>文件名称</th>
                        <th className={`${categoryUi.tableTh} w-[26%]`}>上传时间</th>
                        <th className={`${categoryUi.tableTh} w-[14%]`}>上传人</th>
                        <th className={`${categoryUi.tableTh} w-[14%]`}>文件大小</th>
                        <th className={`${categoryUi.tableThRight} w-[14%]`}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEntries.map((entry) => (
                        <tr key={entry.id} className={categoryUi.tableRow}>
                          <td className={categoryUi.tableTd}>
                            <span className="text-sm font-medium text-slate-900 truncate block max-w-[14rem]" title={entry.name}>
                              {entry.name}
                            </span>
                          </td>
                          <td className={`${categoryUi.tableTdMuted} whitespace-nowrap tabular-nums text-xs`}>
                            {formatUploadTime(entry.uploadedAt)}
                          </td>
                          <td className={categoryUi.tableTd}>{entry.uploadedBy}</td>
                          <td className={`${categoryUi.tableTdMuted} whitespace-nowrap`}>
                            {formatCategoryFileSize(entry.fileSize)}
                          </td>
                          <td className={`${categoryUi.tableTd} text-right`}>
                            <button
                              type="button"
                              title="下载"
                              disabled={downloadingId === entry.id}
                              onClick={() => void handleDownload(entry)}
                              className={categoryUi.actionBtn}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
