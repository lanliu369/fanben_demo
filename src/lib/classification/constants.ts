/** 采购方式枚举（可扩展：新增项写入此列表与 LABELS） */
export const PROCUREMENT_METHODS = [
  'open_tender',
  'invited_tender',
  'inquiry_comparison',
  'bidding',
  'negotiation',
  'direct',
] as const;

export type ProcurementMethod = (typeof PROCUREMENT_METHODS)[number];

export const PROCUREMENT_METHOD_LABELS: Record<ProcurementMethod, string> = {
  open_tender: '公开招标',
  invited_tender: '邀请招标',
  inquiry_comparison: '询比采购',
  bidding: '竞价采购',
  negotiation: '谈判采购',
  direct: '直接采购',
};

/** 评审办法枚举 */
export const EVALUATION_METHODS = [
  'comprehensive_score',
  'lowest_evaluated_price',
  'other',
] as const;

export type EvaluationMethod = (typeof EVALUATION_METHODS)[number];

export const EVALUATION_METHOD_LABELS: Record<EvaluationMethod, string> = {
  comprehensive_score: '综合评分法',
  lowest_evaluated_price: '经评审的最低投标价法',
  other: '其他',
};

export function formatProcurementMethods(methods: ProcurementMethod[]): string {
  return methods.map((m) => PROCUREMENT_METHOD_LABELS[m] ?? m).join('、') || '—';
}

export function formatEvaluationMethods(methods: EvaluationMethod[]): string {
  return methods.map((m) => EVALUATION_METHOD_LABELS[m] ?? m).join('、') || '—';
}

export function parseProcurementMethodLabel(label: string): ProcurementMethod | null {
  const t = label.trim();
  const hit = (PROCUREMENT_METHODS as readonly string[]).find(
    (k) => PROCUREMENT_METHOD_LABELS[k as ProcurementMethod] === t,
  );
  return (hit as ProcurementMethod) ?? null;
}

export function parseEvaluationMethodLabel(label: string): EvaluationMethod | null {
  const t = label.trim();
  const hit = (EVALUATION_METHODS as readonly string[]).find(
    (k) => EVALUATION_METHOD_LABELS[k as EvaluationMethod] === t,
  );
  return (hit as EvaluationMethod) ?? null;
}

/** 树导航：选中「无系统/专业/阶段」的标段 */
export const DOMAIN_LEVEL_NONE_NAV_ID = '__domain-none__';

export const IMPORT_TEMPLATE_HEADERS = [
  '业务板块名称',
  '能源类型',
  '业务阶段',
  '业务性质',
  '系统专业阶段级别',
  '标段级别',
  '采购方式',
  '评审办法',
] as const;

/** 导出列（与导入模板兼容，含更新时间） */
export const EXPORT_HEADERS = [...IMPORT_TEMPLATE_HEADERS, '更新时间'] as const;

/** 导入模板首行数据（固定示例，导入时自动跳过） */
export const IMPORT_TEMPLATE_EXAMPLE_ROW = {
  sectorName: '新能源发电',
  energyType: '陆上风电',
  businessStage: '前期',
  businessNature: '服务',
  domainLevelName: '',
  lotName: '前期咨询服务',
  procurementLabels: '公开招标',
  evaluationLabels: '综合评分法',
} as const;

export const IMPORT_TEMPLATE_INSTRUCTION =
  '说明：表头下一行（首行数据）为固定示例，标红显示；导入时不写入系统。请在其下方填写真实数据后再导入。';
