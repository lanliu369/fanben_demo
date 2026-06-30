'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import {
  commitImportRows,
  downloadImportTemplate,
  parseImportFile,
  validateImportRows,
  type ImportPreview,
  type ImportRowOutcome,
} from '@/lib/classification/import-export';
import { getClassificationStore } from '@/lib/classification/storage';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (result: { imported: number; skipped: number; importedLotIds: string[] }) => void;
};

type Step = 'upload' | 'preview' | 'done';

const OUTCOME_LABEL: Record<ImportRowOutcome, string> = {
  valid: '可导入',
  duplicate: '重复跳过',
  error: '错误',
};

const OUTCOME_STYLE: Record<ImportRowOutcome, string> = {
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  duplicate: 'bg-amber-50 text-amber-700 ring-amber-100',
  error: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export function BatchImportDialog({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    importedLotIds: string[];
  } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseInfo, setParseInfo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setParseErrors([]);
    setParseInfo([]);
    setLoading(false);
    setFileName('');
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setParseErrors([]);
    setParseInfo([]);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseImportFile(buf);
      if (parsed.errors.length > 0) {
        setParseErrors(parsed.errors);
        setLoading(false);
        return;
      }
      if (parsed.skippedExampleRows) {
        setParseInfo([
          `已自动跳过模板示例行 ${parsed.skippedExampleRows} 条（标红示例数据不参与导入）`,
        ]);
      }
      const store = getClassificationStore();
      const p = validateImportRows(parsed.rows, store);
      setPreview(p);
      setStep('preview');
    } catch {
      setParseErrors(['文件读取失败，请重试']);
    } finally {
      setLoading(false);
    }
  };

  const canImport = preview != null && preview.validCount > 0 && preview.errorCount === 0;

  const handleConfirm = () => {
    if (!preview || !canImport) return;
    const r = commitImportRows(preview);
    onImported(r);
    reset();
    onClose();
  };

  return (
    <ModalOverlay>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">批量上传品类</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              上传 → 解析 → 校验预览 → 确认导入（板块可自动创建；采购/评审须匹配枚举）
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {(['upload', 'preview', 'done'] as const).map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-slate-300">→</span>}
                <span
                  className={
                    step === s
                      ? 'text-blue-600 font-medium'
                      : step === 'done' && s !== 'done'
                        ? 'text-slate-400'
                        : ''
                  }
                >
                  {s === 'upload' ? '1. 上传' : s === 'preview' ? '2. 校验预览' : '3. 完成'}
                </span>
              </span>
            ))}
          </div>

          {step === 'upload' && (
            <>
              <p className="text-sm text-slate-600">
                请使用标准模板填写后上传 Excel（.xlsx / .xls）。上传后可预览，确认后写入；未维护的业务板块将自动创建。
              </p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={downloadImportTemplate}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  下载导入模板
                </button>
                <p className="text-xs text-slate-500">
                  模板表头下一行（<span className="text-red-600">标红</span>
                  ）为固定示例，导入时自动跳过、不写入系统；请在示例行下方填写真实数据。
                </p>
              </div>

              {parseInfo.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 space-y-1">
                  <ul className="list-disc pl-5 text-xs space-y-0.5">
                    {parseInfo.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    解析失败
                  </div>
                  <ul className="list-disc pl-5 text-xs space-y-0.5">
                    {parseErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <label
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-12 cursor-pointer transition-colors ${
                  loading
                    ? 'border-slate-200 bg-slate-50 pointer-events-none opacity-70'
                    : 'border-slate-200 hover:bg-slate-50 hover:border-blue-200'
                }`}
              >
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600">
                  {loading ? '正在解析…' : '点击选择 Excel 文件'}
                </span>
                {fileName && !loading && (
                  <span className="text-xs text-slate-400 mt-1">{fileName}</span>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={loading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              {parseInfo.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  {parseInfo.join(' ')}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 ring-1 ring-emerald-100">
                  <span className="text-[10px] opacity-80 block">可导入</span>
                  <span className="text-lg font-semibold tabular-nums">{preview.validCount}</span>
                </div>
                <div className="bg-amber-50 text-amber-700 rounded-lg px-3 py-2 ring-1 ring-amber-100">
                  <span className="text-[10px] opacity-80 block">重复跳过</span>
                  <span className="text-lg font-semibold tabular-nums">{preview.duplicateCount}</span>
                </div>
                <div className="bg-rose-50 text-rose-700 rounded-lg px-3 py-2 ring-1 ring-rose-100">
                  <span className="text-[10px] opacity-80 block">错误</span>
                  <span className="text-lg font-semibold tabular-nums">{preview.errorCount}</span>
                </div>
                <div className="bg-slate-50 text-slate-600 rounded-lg px-3 py-2 ring-1 ring-slate-100">
                  <span className="text-[10px] opacity-80 block">合计</span>
                  <span className="text-lg font-semibold tabular-nums">{preview.rows.length}</span>
                </div>
              </div>

              {preview.errorCount > 0 && (
                <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    存在 {preview.errorCount} 条错误（含采购方式/评审办法与枚举不匹配等），请修正 Excel
                    后重新上传。存在错误时不可导入。
                  </span>
                </div>
              )}

              {preview.validCount > 0 && preview.errorCount === 0 && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>校验通过，共 {preview.validCount} 条可写入；点击下方「确认导入」后入库。</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium w-10">行</th>
                        <th className="text-left px-2 py-1.5 font-medium">品类级别</th>
                        <th className="text-left px-2 py-1.5 font-medium">业务板块</th>
                        <th className="text-left px-2 py-1.5 font-medium">业务类型</th>
                        <th className="text-left px-2 py-1.5 font-medium w-20">结果</th>
                        <th className="text-left px-2 py-1.5 font-medium">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rowStatuses.map((rs) => (
                        <tr key={rs.row.rowIndex} className="hover:bg-slate-50/80">
                          <td className="px-2 py-1.5 text-slate-400 tabular-nums">{rs.row.rowIndex}</td>
                          <td className="px-2 py-1.5 text-slate-800 font-medium">{rs.row.lotName || '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600">
                            {rs.row.sectorName || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500">{rs.businessTypeLabel}</td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${OUTCOME_STYLE[rs.outcome]}`}
                            >
                              {OUTCOME_LABEL[rs.outcome]}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-slate-500 max-w-[200px] truncate" title={rs.messages.join('；')}>
                            {rs.messages.join('；') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.issues.length > 0 && (
                <details className="text-xs border border-slate-200 rounded-lg">
                  <summary className="px-3 py-2 cursor-pointer text-slate-600 bg-slate-50 hover:bg-slate-100">
                    查看跳过明细（{preview.issues.length} 条）
                  </summary>
                  <ul className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                    {preview.issues.map((issue, i) => (
                      <li
                        key={i}
                        className={`px-3 py-1.5 ${
                          issue.level === 'error' ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        第 {issue.rowIndex} 行 [{issue.level === 'error' ? '错误' : '提示'}]：{issue.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {step === 'done' && result && (
            <div className="flex items-start gap-3 text-sm text-slate-700 bg-emerald-50 rounded-lg px-4 py-4 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-emerald-800">导入完成</p>
                <p className="mt-1 text-slate-600">
                  成功写入 <span className="font-semibold tabular-nums">{result.imported}</span> 条，跳过{' '}
                  <span className="font-semibold tabular-nums">{result.skipped}</span> 条（重复或错误行）。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <div>
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setPreview(null);
                  setParseErrors([]);
                  setParseInfo([]);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                重新上传
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              {step === 'done' ? '关闭' : '取消'}
            </button>
            {step === 'preview' && (
              <button
                type="button"
                disabled={!canImport}
                onClick={handleConfirm}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
              >
                确认导入（{preview?.validCount ?? 0} 条）
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
