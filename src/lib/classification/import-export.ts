import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import type { ClassificationStore, LotLevel } from '@/types';
import {
  EVALUATION_METHOD_LABELS,
  EXPORT_HEADERS,
  IMPORT_TEMPLATE_EXAMPLE_ROW,
  IMPORT_TEMPLATE_HEADERS,
  IMPORT_TEMPLATE_INSTRUCTION,
  PROCUREMENT_METHOD_LABELS,
  parseEvaluationMethodLabel,
  parseProcurementMethodLabel,
  type EvaluationMethod,
  type ProcurementMethod,
} from './constants';
import type { LotSearchFilters } from './search';
import { filterLotLevels } from './search';
import { buildUniquenessKey, generateLotCode } from './code';
import {
  checkLotDuplicate,
  findOrCreateBusinessSector,
  findOrCreateBusinessType,
  findOrCreateDomainLevel,
  type LotFormInput,
} from './crud';
import { resolveLotLevelPath } from './resolve';
import { getClassificationStore, setClassificationStore } from './storage';

export type ImportRow = {
  rowIndex: number;
  sectorName: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelName: string;
  lotName: string;
  procurementLabels: string;
  evaluationLabels: string;
};

export type ImportRowIssue = {
  rowIndex: number;
  level: 'error' | 'warn';
  message: string;
};

export type ImportRowOutcome = 'valid' | 'duplicate' | 'error';

export type ImportRowStatus = {
  row: ImportRow;
  outcome: ImportRowOutcome;
  /** 业务类型展示（能源-阶段-性质） */
  businessTypeLabel: string;
  messages: string[];
};

export type ImportPreview = {
  rows: ImportRow[];
  rowStatuses: ImportRowStatus[];
  issues: ImportRowIssue[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
};

export type ParseImportResult = {
  rows: ImportRow[];
  errors: string[];
  /** 已跳过的模板示例行数 */
  skippedExampleRows?: number;
};

type ParsedImportRowFields = {
  sectorName: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  domainLevelName: string;
  lotName: string;
  procurementLabels: string;
  evaluationLabels: string;
};

function findImportHeaderRowIndex(matrix: string[][]): number {
  return matrix.findIndex((row) =>
    (row ?? []).some((cell) => String(cell).trim() === '业务板块名称'),
  );
}

function parseRowFields(
  r: string[],
  col: (name: string) => string,
): ParsedImportRowFields {
  return {
    sectorName: col('业务板块名称'),
    energyType: col('能源类型'),
    businessStage: col('业务阶段'),
    businessNature: col('业务性质'),
    domainLevelName: col('系统专业阶段级别'),
    lotName: col('标段级别'),
    procurementLabels: col('采购方式'),
    evaluationLabels: col('评审办法'),
  };
}

/** 与模板固定示例行一致时导入跳过 */
export function isImportTemplateExampleRow(fields: ParsedImportRowFields): boolean {
  const ex = IMPORT_TEMPLATE_EXAMPLE_ROW;
  return (
    fields.sectorName === ex.sectorName &&
    fields.energyType === ex.energyType &&
    fields.businessStage === ex.businessStage &&
    fields.businessNature === ex.businessNature &&
    (fields.domainLevelName || '') === ex.domainLevelName &&
    fields.lotName === ex.lotName &&
    fields.procurementLabels === ex.procurementLabels &&
    fields.evaluationLabels === ex.evaluationLabels
  );
}

function splitMultiLabels(raw: string): string[] {
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMethods<T extends string>(
  raw: string,
  parser: (label: string) => T | null,
  labelMap: Record<string, string>,
): { methods: T[]; errors: string[] } {
  const labels = splitMultiLabels(raw);
  const methods: T[] = [];
  const errors: string[] = [];
  labels.forEach((label) => {
    const m = parser(label);
    if (m) methods.push(m);
    else errors.push(`未知项「${label}」，可选：${Object.values(labelMap).join('、')}`);
  });
  return { methods, errors };
}

export function parseImportFile(buffer: ArrayBuffer): ParseImportResult {
  const errors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    return { rows: [], errors: ['无法解析 Excel 文件，请确认格式为 .xlsx / .xls'] };
  }
  if (!wb.SheetNames.length) {
    return { rows: [], errors: ['工作簿为空'] };
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];
  if (!matrix.length) {
    return { rows: [], errors: ['表格无表头行'] };
  }
  const headerRowIndex = findImportHeaderRowIndex(matrix);
  if (headerRowIndex < 0) {
    errors.push('未找到表头行「业务板块名称」，请下载标准模板');
    return { rows: [], errors };
  }
  const header = matrix[headerRowIndex].map((c) => String(c).trim());
  const col = (name: string) => header.indexOf(name);
  const missingHeaders = IMPORT_TEMPLATE_HEADERS.filter((h) => col(h) < 0);
  if (missingHeaders.length > 0) {
    errors.push(`缺少列：${missingHeaders.join('、')}（请下载标准模板）`);
  }
  const rows: ImportRow[] = [];
  let skippedExampleRows = 0;
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((c) => !String(c).trim())) continue;
    const get = (name: string) => {
      const idx = col(name);
      return idx >= 0 ? String(r[idx] ?? '').trim() : '';
    };
    const fields = parseRowFields(r, get);
    if (isImportTemplateExampleRow(fields)) {
      skippedExampleRows += 1;
      continue;
    }
    rows.push({
      rowIndex: i + 1,
      ...fields,
    });
  }
  if (rows.length === 0 && errors.length === 0) {
    errors.push('未解析到可导入数据行（示例行已自动跳过，请填写真实数据）');
  }
  return {
    rows,
    errors,
    skippedExampleRows: skippedExampleRows > 0 ? skippedExampleRows : undefined,
  };
}

/** @deprecated 使用 parseImportFile 返回的 ParseImportResult */
export function parseImportFileRows(buffer: ArrayBuffer): ImportRow[] {
  return parseImportFile(buffer).rows;
}

const PROCUREMENT_ENUM_HINT = Object.values(PROCUREMENT_METHOD_LABELS).join('、');
const EVALUATION_ENUM_HINT = Object.values(EVALUATION_METHOD_LABELS).join('、');

type ValidatedImportMethods =
  | {
      ok: true;
      procurementMethods: ProcurementMethod[];
      evaluationMethods: EvaluationMethod[];
    }
  | { ok: false; errors: string[] };

/** 采购方式、评审办法必填且须完全匹配系统枚举，否则报错 */
function validateImportRowMethods(row: ImportRow): ValidatedImportMethods {
  const errors: string[] = [];
  const procRaw = row.procurementLabels?.trim() ?? '';
  const evalRaw = row.evaluationLabels?.trim() ?? '';

  const proc = procRaw
    ? parseMethods(procRaw, parseProcurementMethodLabel, PROCUREMENT_METHOD_LABELS)
    : { methods: [] as string[], errors: [] as string[] };
  const evalM = evalRaw
    ? parseMethods(evalRaw, parseEvaluationMethodLabel, EVALUATION_METHOD_LABELS)
    : { methods: [] as string[], errors: [] as string[] };

  if (!procRaw) {
    errors.push('采购方式为必填');
  } else {
    proc.errors.forEach((e) => errors.push(`采购方式：${e}`));
    if (proc.methods.length === 0) {
      errors.push(`采购方式无有效枚举值，可选：${PROCUREMENT_ENUM_HINT}`);
    }
  }

  if (!evalRaw) {
    errors.push('评审办法为必填');
  } else {
    evalM.errors.forEach((e) => errors.push(`评审办法：${e}`));
    if (evalM.methods.length === 0) {
      errors.push(`评审办法无有效枚举值，可选：${EVALUATION_ENUM_HINT}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    procurementMethods: proc.methods as ProcurementMethod[],
    evaluationMethods: evalM.methods.slice(0, 1) as EvaluationMethod[],
  };
}

/** 导入预览：仅解析必填与重复检测，不阻断「业务板块不存在」等（导入时自动创建） */
export function validateImportRows(rows: ImportRow[], store?: ClassificationStore): ImportPreview {
  const s = store ?? getClassificationStore();
  const issues: ImportRowIssue[] = [];
  const rowStatuses: ImportRowStatus[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const seenKeys = new Set<string>();

  rows.forEach((row) => {
    const messages: string[] = [];
    const businessTypeLabel = [row.energyType, row.businessStage, row.businessNature]
      .filter(Boolean)
      .join('-');

    if (!row.sectorName?.trim() || !row.lotName?.trim()) {
      const msg = '缺少业务板块名称或标段级别';
      issues.push({ rowIndex: row.rowIndex, level: 'error', message: msg });
      messages.push(msg);
      errorCount++;
      rowStatuses.push({ row, outcome: 'error', businessTypeLabel: businessTypeLabel || '—', messages });
      return;
    }

    const sector = s.businessSectors.find((x) => x.name === row.sectorName.trim());
    if (!sector) {
      messages.push('业务板块将自动创建');
    }

    const methodCheck = validateImportRowMethods(row);
    if (!methodCheck.ok) {
      methodCheck.errors.forEach((msg) => {
        issues.push({ rowIndex: row.rowIndex, level: 'error', message: msg });
        messages.push(msg);
      });
      errorCount++;
      rowStatuses.push({ row, outcome: 'error', businessTypeLabel: businessTypeLabel || '—', messages });
      return;
    }
    const { procurementMethods, evaluationMethods } = methodCheck;

    const key = buildUniquenessKey({
      businessSectorName: row.sectorName.trim(),
      energyType: row.energyType || '—',
      businessStage: row.businessStage || '—',
      businessNature: row.businessNature || '—',
      domainLevelName: row.domainLevelName,
      lotName: row.lotName,
    });

    let outcome: ImportRowOutcome = 'valid';

    if (seenKeys.has(key)) {
      messages.push('与文件中其他行路径重复，导入时将跳过');
      duplicateCount++;
      outcome = 'duplicate';
    } else {
      seenKeys.add(key);
      if (sector) {
        const form: LotFormInput = {
          businessSectorId: sector.id,
          energyType: row.energyType || '—',
          businessStage: row.businessStage || '—',
          businessNature: row.businessNature || '—',
          domainLevelNameNew: row.domainLevelName || undefined,
          lotName: row.lotName,
          procurementMethods,
          evaluationMethods,
        };
        if (checkLotDuplicate(s, form)) {
          messages.push('系统中已存在相同路径标段，导入时将跳过');
          duplicateCount++;
          outcome = 'duplicate';
        } else {
          validCount++;
        }
      } else {
        validCount++;
      }
    }

    rowStatuses.push({ row, outcome, businessTypeLabel: businessTypeLabel || '—', messages });
  });

  return { rows, rowStatuses, issues, validCount, duplicateCount, errorCount };
}

export type ImportCommitResult = {
  imported: number;
  skipped: number;
  /** 本次成功写入的标段 id，供页面刷新后定位 */
  importedLotIds: string[];
};

export function commitImportRows(
  preview: ImportPreview | ImportRow[],
): ImportCommitResult {
  const toImport =
    'rowStatuses' in preview
      ? preview.rowStatuses.filter((rs) => rs.outcome === 'valid').map((rs) => rs.row)
      : preview;
  const store = getClassificationStore();
  let imported = 0;
  let skipped = 0;
  const importedLotIds: string[] = [];
  if ('rowStatuses' in preview) {
    skipped += preview.rowStatuses.filter((rs) => rs.outcome !== 'valid').length;
  }
  toImport.forEach((row) => {
    const sector = findOrCreateBusinessSector(store, row.sectorName);
    if (!sector || !row.lotName?.trim()) {
      skipped++;
      return;
    }
    const methodCheck = validateImportRowMethods(row);
    if (!methodCheck.ok) {
      skipped++;
      return;
    }
    const { procurementMethods, evaluationMethods } = methodCheck;
    const form: LotFormInput = {
      businessSectorId: sector.id,
      energyType: row.energyType || '—',
      businessStage: row.businessStage || '—',
      businessNature: row.businessNature || '—',
      domainLevelNameNew: row.domainLevelName || undefined,
      lotName: row.lotName,
      procurementMethods,
      evaluationMethods,
    };
    if (checkLotDuplicate(store, form)) {
      skipped++;
      return;
    }
    const bt = findOrCreateBusinessType(store, {
      businessSectorId: sector.id,
      energyType: row.energyType || '—',
      businessStage: row.businessStage || '—',
      businessNature: row.businessNature || '—',
    });
    const domain = findOrCreateDomainLevel(store, {
      businessTypeId: bt.id,
      domainLevelNameNew: row.domainLevelName || undefined,
    });
    const code = generateLotCode({
      sector,
      businessType: bt,
      domainLevel: domain,
      lotName: row.lotName,
    });
    const now = new Date().toISOString().slice(0, 10);
    const lotId = `lot-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lot: LotLevel = {
      id: lotId,
      code,
      name: row.lotName.trim(),
      businessSectorId: sector.id,
      businessTypeId: bt.id,
      domainLevelId: domain?.id,
      procurementMethods,
      evaluationMethods,
      createdAt: now,
      updatedAt: now,
    };
    store.lotLevels.push(lot);
    importedLotIds.push(lotId);
    imported++;
  });
  setClassificationStore(store);
  return { imported, skipped, importedLotIds };
}

/** 导出筛选条件（与列表组合筛选一致） */
export type ExportFilters = LotSearchFilters;

export type ExportScope = 'all' | 'current' | 'custom';

export function getLotsForExport(
  scope: ExportScope,
  store: ClassificationStore,
  options?: { customFilters?: ExportFilters; currentFilters?: ExportFilters },
): LotLevel[] {
  if (scope === 'all') return filterLotLevels({}, store);
  if (scope === 'current' && options?.currentFilters) {
    return filterLotLevels(options.currentFilters, store);
  }
  return filterLotLevels(options?.customFilters ?? {}, store);
}

export function describeExportScope(
  scope: ExportScope,
  count: number,
  format: 'xlsx' | 'csv',
  store: ClassificationStore,
  filters?: ExportFilters,
): string {
  const scopeLabel =
    scope === 'all' ? '全量' : scope === 'current' ? '当前列表条件' : '自定义条件';
  if (scope === 'all' || !filters) {
    return `${scopeLabel}导出，共 ${count} 条，格式 ${format.toUpperCase()}`;
  }
  const parts: string[] = [];
  if (filters.businessSectorId) {
    const s = store.businessSectors.find((x) => x.id === filters.businessSectorId);
    parts.push(`业务板块=${s?.name ?? filters.businessSectorId}`);
  }
  if (filters.energyType) parts.push(`能源类型=${filters.energyType}`);
  if (filters.businessStage) parts.push(`业务阶段=${filters.businessStage}`);
  if (filters.businessNature) parts.push(`业务性质=${filters.businessNature}`);
  if (filters.domainLevelId) {
    const d = store.domainLevels.find((x) => x.id === filters.domainLevelId);
    parts.push(`专业域=${d?.name ?? filters.domainLevelId}`);
  }
  if (filters.lotName) parts.push(`检索=${filters.lotName}`);
  if (filters.procurementMethod) {
    parts.push(`采购方式=${PROCUREMENT_METHOD_LABELS[filters.procurementMethod]}`);
  }
  if (filters.evaluationMethod) {
    parts.push(`评审办法=${EVALUATION_METHOD_LABELS[filters.evaluationMethod]}`);
  }
  const cond = parts.length > 0 ? parts.join('；') : '未限定';
  return `${scopeLabel}（${cond}），共 ${count} 条，格式 ${format.toUpperCase()}`;
}

export function buildExportRows(
  lotIds: string[],
  store?: ClassificationStore,
): string[][] {
  const s = store ?? getClassificationStore();
  const header = [...EXPORT_HEADERS];
  const data: string[][] = [header];
  lotIds.forEach((id) => {
    const path = resolveLotLevelPath(id, s);
    if (!path) return;
    const lot = s.lotLevels.find((l) => l.id === id);
    data.push([
      path.businessSectorName,
      path.energyType,
      path.businessStage,
      path.businessNature,
      path.domainLevelName ?? '',
      path.lotLevelName,
      path.procurementMethods.map((m) => PROCUREMENT_METHOD_LABELS[m]).join('、'),
      path.evaluationMethods.map((m) => EVALUATION_METHOD_LABELS[m]).join('、'),
      lot?.updatedAt ?? '',
    ]);
  });
  return data;
}

export function exportLotsToFile(
  scope: ExportScope,
  format: 'xlsx' | 'csv',
  store: ClassificationStore,
  options?: { customFilters?: ExportFilters; currentFilters?: ExportFilters },
): { rowCount: number; filename: string; detail: string } {
  const lots = getLotsForExport(scope, store, options);
  const rows = buildExportRows(
    lots.map((l) => l.id),
    store,
  );
  const date = new Date().toISOString().slice(0, 10);
  const suffix = scope === 'all' ? '全量' : scope === 'current' ? '条件' : '筛选';
  const filename = `招采分类导出_${suffix}_${date}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
  if (format === 'xlsx') {
    downloadExportXlsx(rows, filename);
  } else {
    downloadExportCsv(rows, filename);
  }
  const filters =
    scope === 'current' ? options?.currentFilters : scope === 'custom' ? options?.customFilters : undefined;
  return {
    rowCount: lots.length,
    filename,
    detail: describeExportScope(scope, lots.length, format, store, filters),
  };
}

export function downloadExportXlsx(rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '招采分类');
  XLSX.writeFile(wb, filename);
}

export function downloadExportCsv(rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TEMPLATE_NOTE_STYLE = {
  font: { color: { rgb: '64748B' }, sz: 10 },
  alignment: { wrapText: true, vertical: 'center' },
};

const TEMPLATE_EXAMPLE_STYLE = {
  font: { color: { rgb: 'DC2626' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } },
  alignment: { vertical: 'center' },
};

function setSheetCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: string,
  style?: object,
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { t: 's', v: value };
  if (style) ws[addr].s = style;
}

export function downloadImportTemplate() {
  const ex = IMPORT_TEMPLATE_EXAMPLE_ROW;
  const ws: XLSX.WorkSheet = {};
  const colCount = IMPORT_TEMPLATE_HEADERS.length;

  setSheetCell(ws, 0, 0, IMPORT_TEMPLATE_INSTRUCTION, TEMPLATE_NOTE_STYLE);
  IMPORT_TEMPLATE_HEADERS.forEach((h, c) => setSheetCell(ws, 1, c, h));
  const exampleValues = [
    ex.sectorName,
    ex.energyType,
    ex.businessStage,
    ex.businessNature,
    ex.domainLevelName,
    ex.lotName,
    ex.procurementLabels,
    ex.evaluationLabels,
  ];
  exampleValues.forEach((v, c) => setSheetCell(ws, 2, c, v, TEMPLATE_EXAMPLE_STYLE));

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 2, c: colCount - 1 },
  });
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, '招采分类');
  XLSXStyle.writeFile(wb, '招采分类导入模板.xlsx');
}
