// ==================== 招采业务分类（四级，主数据） ====================
/**
 * 新模型：BusinessSector → BusinessType → DomainLevel → LotLevel
 *
 * @deprecated 以下旧三级类型已移除，请勿新增引用：
 * - Industry（产业领域）→ 使用 BusinessSector
 * - ProcurementCategory（采购分类）→ 拆解为 BusinessType（能源/阶段/性质）
 * - Category（品类叶子）→ 使用 LotLevel（标段级别）
 *
 * 历史 localStorage（oo-classification / oo-categories）由 migrate-store 自动迁移至 oo-classification-v2。
 */
import type { EvaluationMethod, ProcurementMethod } from '@/lib/classification/constants';

export type { EvaluationMethod, ProcurementMethod };

export interface BusinessSector {
  id: string;
  code: string;
  name: string;
  /** 排序编号，数字越小越靠前，最大 99 */
  sortOrder?: number;
  /** 一级分类业务说明（字典元数据，非标段字段） */
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessType {
  id: string;
  businessSectorId: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  displayName: string;
  sortOrder?: number;
  /** 二级分类业务说明（字典元数据，非标段字段） */
  description?: string;
  /** 第 5 级「无系统/专业/阶段」占位节点的树形说明 */
  unassignedDomainDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DomainLevel {
  id: string;
  name: string;
  businessTypeId: string;
  sortOrder?: number;
  /** 三级分类业务说明（字典元数据，非标段字段） */
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 标段级别：最终业务叶子节点 */
export interface LotLevel {
  id: string;
  code: string;
  name: string;
  businessSectorId: string;
  businessTypeId: string;
  domainLevelId?: string;
  procurementMethods: ProcurementMethod[];
  evaluationMethods: EvaluationMethod[];
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationStore {
  businessSectors: BusinessSector[];
  businessTypes: BusinessType[];
  domainLevels: DomainLevel[];
  lotLevels: LotLevel[];
}

/** 品类管理页上传的 Excel 归档（元数据；文件二进制存 IndexedDB） */
export interface CategoryFileUpload {
  id: string;
  /** 用户填写的归档名称 */
  name: string;
  /** 版本号，如 V1.0 */
  version: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
}

/** 标段完整路径（用于列表展示与关联模块冗余字段） */
export interface LotLevelPath {
  lotLevelId: string;
  lotLevelCode: string;
  lotLevelName: string;
  businessSectorId: string;
  businessSectorCode: string;
  businessSectorName: string;
  businessTypeId: string;
  energyType: string;
  businessStage: string;
  businessNature: string;
  businessTypeDisplayName: string;
  domainLevelId?: string;
  domainLevelName?: string;
  procurementMethods: ProcurementMethod[];
  evaluationMethods: EvaluationMethod[];
}

// ==================== 框架管理类型 ====================
export interface Framework {
  id: string;
  name: string;
  description?: string;
  lotLevelId?: string;
  lotLevelName?: string;
  /** @deprecated */
  categoryId?: string;
  categoryName?: string;
  procurementCategoryName?: string;
  industryName?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  frameworkId: string;
  title: string;
  order: number;
  level: number;
  parentId?: string;
  children?: Chapter[];
  boundTexts?: TextFragment[];
}

// ==================== 文本管理类型 ====================
export interface TextVersion {
  content: string;
  updatedAt: string;
}

export interface TextFragment {
  id: string;
  name: string;
  module?: 'text' | 'qualification' | 'evaluation' | 'contract-clause';
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  bindings?: TextBinding[];
  versions: TextVersion[];
  /** 资源正文版本号；每次「保存」递增，范本内嵌正文需通过「同步到所有范本」对齐到当前版本 */
  contentVersion?: number;
  /** 各范本最近一次将本资源正文同步进章节时的 contentVersion */
  templateSyncedVersion?: Record<string, number>;
  /**
   * 适用标段范围（数据来源：招采业务分类叶子标段）
   * - `true` 或未设置：通用标段，任意范本均可引用、侧栏展示。
   * - `false`：仅 `applicableLotLevelIds` 所选标段下的范本侧栏展示。
   */
  applicableToAllLotLevels?: boolean;
  /** @deprecated 使用 applicableToAllLotLevels */
  applicableToAllCategories?: boolean;
  applicableLotLevelIds?: string[];
  /** @deprecated 使用 applicableLotLevelIds */
  applicableCategoryIds?: string[];
  /** 逻辑删除：存在则表示已删除（禁止物理删 localStorage 行） */
  deletedAt?: string;
  deletedBy?: string;
}

export interface TextBinding {
  id: string;
  textFragmentId: string;
  /** 范本 ID — 绑定到范本中的某一节（与 templateSectionId 成对） */
  templateId?: string;
  /** 范本章节节点 ID（对应 TemplateSection.id） */
  templateSectionId?: string;
  templateName?: string;
  sectionTitle?: string;
  order: number;
  /** 兼容旧版数据 / localStorage：框架 + 大纲章节 ID */
  frameworkId?: string;
  chapterId?: string;
  frameworkName?: string;
  chapterTitle?: string;
}

// ==================== 编辑器大纲类型 ====================
export interface OutlineItem {
  level: number;   // heading level 1-6
  text: string;
  pos: number;     // ProseMirror position
}

// ==================== 范本管理类型 ====================
export interface Template {
  id: string;
  name: string;
  description?: string;
  frameworkId: string;
  /** 绑定标段级别（叶子） */
  lotLevelId: string;
  lotLevelCode?: string;
  lotLevelName?: string;
  businessSectorId?: string;
  businessSectorName?: string;
  businessTypeId?: string;
  businessTypeDisplayName?: string;
  energyType?: string;
  businessStage?: string;
  businessNature?: string;
  domainLevelId?: string;
  domainLevelName?: string;
  procurementMethods?: ProcurementMethod[];
  evaluationMethods?: EvaluationMethod[];
  /** @deprecated 使用 lotLevelId */
  categoryId?: string;
  categoryName?: string;
  industryId?: string;
  industryName?: string;
  procurementCategoryId?: string;
  procurementCategoryName?: string;
  version?: string;
  editProgress?: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  sections: TemplateSection[];
  variables: TemplateVariable[];
  /** 逻辑删除 */
  deletedAt?: string;
  deletedBy?: string;
}

export interface TemplateSection {
  id: string;
  templateId: string;
  chapterId: string;
  title: string;
  order: number;
  level: number;
  parentId?: string;
  content: string;
  textFragmentId?: string;
  children?: TemplateSection[];
}

export interface TemplateVariable {
  id: string;
  name: string;
  key: string;
  description?: string;
  /** @deprecated 已不再使用，保留仅为兼容旧数据 */
  required?: boolean;
  defaultValue?: string;
  /** global：全范本通用（系统预置）；template：仅当前范本，保存在范本内 */
  scope?: 'global' | 'template';
}

// ==================== 招标文件类型 ====================
export interface BidDocument {
  id: string;
  name: string;
  templateId: string;
  templateName?: string;
  projectName: string;
  status: 'draft' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  variableValues: VariableValue[];
  sections: BidDocumentSection[];
  /** 继承范本标段与招采规则 */
  lotLevelId?: string;
  lotLevelCode?: string;
  lotLevelName?: string;
  businessSectorId?: string;
  businessSectorName?: string;
  businessTypeId?: string;
  businessTypeDisplayName?: string;
  energyType?: string;
  businessStage?: string;
  businessNature?: string;
  domainLevelId?: string;
  domainLevelName?: string;
  procurementMethods?: ProcurementMethod[];
  evaluationMethods?: EvaluationMethod[];
  /** 逻辑删除 */
  deletedAt?: string;
  deletedBy?: string;
}

export interface VariableValue {
  variableId: string;
  key: string;
  name: string;
  value: string;
}

export interface BidDocumentSection {
  id: string;
  title: string;
  order: number;
  level: number;
  parentId?: string;
  content: string;
  children?: BidDocumentSection[];
}

/** 本地演示数据变更审计（写入 localStorage） */
export type DataAuditScope = 'template' | 'text' | 'bid' | 'category';

export type DataAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'sync'
  | 'import'
  | 'export'
  | 'activate'
  | 'deactivate';

export interface DataAuditEntry {
  id: string;
  at: string;
  actor: string;
  scope: DataAuditScope;
  action: DataAuditAction;
  entityId?: string;
  label?: string;
  detail?: string;
}

// ==================== 通用类型 ====================
export type TabKey =
  | 'dashboard'
  | 'category'
  | 'text'
  | 'qualification'
  | 'evaluation'
  | 'contract-clause'
  | 'template-variables'
  | 'template'
  | 'bid-document';

export interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
