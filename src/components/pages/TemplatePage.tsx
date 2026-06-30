'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, FileText, Download, X,
  Send, ClipboardList, Copy, Settings,
} from 'lucide-react';
import { asBlob } from 'html-docx-js-typescript';
import type { Template, Framework, TemplateSection, Chapter } from '@/types';
import {
  getLotLevelPath,
  getMockTemplates,
  getMockTextFragments,
  setMockTemplates,
  softDeleteTemplate,
  duplicateMockTemplate,
  syncTemplateFragmentBindingsFromSections,
} from '@/lib/mockData';
import { clearTemplateResourceInserts, getTemplateResourceInserts } from '@/lib/templateResourceInserts';
import { getClassificationStore, templateFieldsFromLotPath } from '@/lib/classification';
import { seedLotIds } from '@/lib/classification/seed-lot-ids';
import {
  LotCascadeFields,
  emptyLotCascade,
  lotCascadeFromLotId,
  type LotCascadeValue,
} from '@/components/classification/LotCascadeFields';
import {
  TemplateLotMetaFields,
  emptyTemplateLotMeta,
  type TemplateLotMetaValue,
} from '@/components/classification/TemplateLotMetaFields';
import { appendDataAudit, getMockActor, getTemplateAuditLogs } from '@/lib/dataAudit';
import { OperationLogDialog } from '@/components/ui/OperationLogDialog';
import { systemUi } from '@/lib/systemUi';
import { FormSelect } from '@/components/ui/FormSelect';
import { resolveSectionRichHtml } from '@/lib/resolveTemplateSectionHtml';
import { WpsTemplateEditor } from '@/components/editor/WpsTemplateEditor';
import { saveTemplateDocxCache } from '@/lib/templateDocxCache';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { useGlobalLoading } from '@/components/ui/GlobalLoading';
import { useAppShell } from '@/contexts/AppShellContext';
import { previewTableText } from '@/lib/previewText';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import { buildTemplateSectionsFromGeneralTemplate, composeReferencedTemplateFromGeneralTemplate } from '@/lib/generalTemplateApply';
import { buildSectionsHtmlWithResources } from '@/lib/resolveTemplateSectionHtml';
import { calcTemplateEditProgress } from '@/lib/templateEditProgress';
import { getGeneralTemplateParsedContent, generalTemplateHasParsedContent, listGeneralTemplates, patchGeneralTemplateManifest } from '@/lib/general-templates';
import { templateReferencesGeneralTemplate } from '@/lib/generalTemplateSync';
import {
  buildAiMatchGroups,
  lotMetaFromTemplate,
  scoreTemplateItem,
  type TemplateListAiMatchGroup,
} from '@/lib/templateListQuery';
import {
  TemplateAiSearchPanel,
  TemplateCategoryFilterPanel,
  TemplateListActiveFilterTags,
  TemplateUpdatedTimeFilterPanel,
} from '@/components/templates/TemplateListQueryPanels';


function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('读取文件失败'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Mock 框架数据 ────────────────────────────────────────────────────────────

const defaultChapters = [
  { id: 'dch-1', frameworkId: 'fw-default', title: '第一章 招标公告', order: 1, level: 1, children: [] },
  { id: 'dch-2', frameworkId: 'fw-default', title: '第二章 投标人须知', order: 2, level: 1, children: [] },
  { id: 'dch-3', frameworkId: 'fw-default', title: '第三章 技术规格要求', order: 3, level: 1, children: [] },
  { id: 'dch-4', frameworkId: 'fw-default', title: '第四章 评标办法', order: 4, level: 1, children: [] },
  { id: 'dch-5', frameworkId: 'fw-default', title: '第五章 合同条款', order: 5, level: 1, children: [] },
];

const mockFrameworks: Framework[] = [
  {
    id: 'fw-1',
    name: '储能电站EPC招标框架',
    lotLevelId: seedLotIds.kxx,
    lotLevelName: '储能电站EPC',
    status: 'published',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20',
    chapters: [
      { id: 'ch-1', frameworkId: 'fw-1', title: '第一章 招标公告', order: 1, level: 1, children: [
        { id: 'ch-1-1', frameworkId: 'fw-1', title: '1.1 项目概述', order: 1, level: 2, parentId: 'ch-1' },
        { id: 'ch-1-2', frameworkId: 'fw-1', title: '1.2 资格要求', order: 2, level: 2, parentId: 'ch-1' },
      ]},
      { id: 'ch-2', frameworkId: 'fw-1', title: '第二章 投标人须知', order: 2, level: 1, children: [
        { id: 'ch-2-1', frameworkId: 'fw-1', title: '2.1 总则', order: 1, level: 2, parentId: 'ch-2' },
        { id: 'ch-2-2', frameworkId: 'fw-1', title: '2.2 投标文件要求', order: 2, level: 2, parentId: 'ch-2' },
        { id: 'ch-2-3', frameworkId: 'fw-1', title: '2.3 评标标准', order: 3, level: 2, parentId: 'ch-2' },
      ]},
      { id: 'ch-3', frameworkId: 'fw-1', title: '第三章 技术规格要求', order: 3, level: 1, children: [
        { id: 'ch-3-1', frameworkId: 'fw-1', title: '3.1 技术参数', order: 1, level: 2, parentId: 'ch-3' },
        { id: 'ch-3-2', frameworkId: 'fw-1', title: '3.2 验收标准', order: 2, level: 2, parentId: 'ch-3' },
      ]},
      { id: 'ch-4', frameworkId: 'fw-1', title: '第四章 合同条款', order: 4, level: 1, children: [] },
    ],
  },
  {
    id: 'fw-2',
    name: '光伏项目EPC工程总承包招标框架',
    lotLevelId: seedLotIds.kancha,
    lotLevelName: '光伏项目EPC工程总承包',
    status: 'published',
    createdAt: '2024-01-18',
    updatedAt: '2024-01-22',
    chapters: [
      { id: 'ch-5', frameworkId: 'fw-2', title: '第一章 项目说明', order: 1, level: 1, children: [
        { id: 'ch-5-1', frameworkId: 'fw-2', title: '1.1 项目背景', order: 1, level: 2, parentId: 'ch-5' },
        { id: 'ch-5-2', frameworkId: 'fw-2', title: '1.2 项目目标', order: 2, level: 2, parentId: 'ch-5' },
      ]},
      { id: 'ch-6', frameworkId: 'fw-2', title: '第二章 服务内容与要求', order: 2, level: 1, children: [] },
      { id: 'ch-7', frameworkId: 'fw-2', title: '第三章 技术规格要求', order: 3, level: 1, children: [] },
    ],
  },
  {
    id: 'fw-default',
    name: '通用招标框架',
    lotLevelId: '',
    lotLevelName: '通用',
    status: 'published',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    chapters: defaultChapters,
  },
];

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 无预设框架：新建范本时章节为空，由用户在金山 WebOffice 中通过标题手动搭建 */
const FW_MANUAL = 'fw-manual';

function flattenAllChapters(chapters: Chapter[]): Chapter[] {
  const out: Chapter[] = [];
  const walk = (chs: Chapter[]) => {
    chs.forEach((ch) => {
      out.push(ch);
      if (ch.children?.length) walk(ch.children);
    });
  };
  walk(chapters);
  return out;
}

function assignTemplateId(sections: TemplateSection[], templateId: string): TemplateSection[] {
  return sections.map((s) => ({
    ...s,
    templateId,
    children: s.children?.length ? assignTemplateId(s.children, templateId) : undefined,
  }));
}

/** 按框架树生成范本章节（含子节），与资源「绑定到某范本某节」一致 */
function buildSections(frameworkId: string, progress: number): TemplateSection[] {
  if (frameworkId === FW_MANUAL) {
    return [];
  }
  const fw = mockFrameworks.find(f => f.id === frameworkId) ?? mockFrameworks.find(f => f.id === 'fw-default')!;
  const allFlat = flattenAllChapters(fw.chapters);
  const total = Math.max(allFlat.length, 1);
  const filledCount = Math.round((progress / 100) * total);
  const filledIds = new Set(allFlat.slice(0, filledCount).map((c) => c.id));

  const mapChapter = (ch: Chapter): TemplateSection => ({
    id: `sec-${frameworkId}-${ch.id}`,
    templateId: '',
    chapterId: ch.id,
    title: ch.title,
    order: ch.order,
    level: ch.level,
    parentId: ch.parentId,
    content: filledIds.has(ch.id)
      ? `【${ch.title}】\n\n本章节内容已编辑完成，包含相关条款和要求。`
      : '',
    children: ch.children?.length ? ch.children.map(mapChapter) : undefined,
  });

  return fw.chapters.filter((ch) => ch.level === 1).map(mapChapter);
}

function suggestVersionForLot(templates: Template[], lotLevelId: string): string {
  const n = templates.filter((t) => t.lotLevelId === lotLevelId && !t.deletedAt).length;
  return `V${n + 1}.0`;
}

function makeTpl(
  id: string,
  name: string,
  lotLevelId: string,
  frameworkId: string,
  version: string,
  status: Template['status'],
  editProgress: number,
  createdAt: string,
  updatedAt: string,
  description?: string,
  options?: {
    sections?: TemplateSection[];
    generalTemplateId?: string;
    generalTemplateSyncedVersion?: number;
  },
): Template {
  const path = lotLevelId ? getLotLevelPath(lotLevelId) : null;
  const sections = options?.sections?.length
    ? assignTemplateId(options.sections, id)
    : assignTemplateId(buildSections(frameworkId, editProgress), id);
  return {
    id,
    name,
    description,
    frameworkId,
    lotLevelId: lotLevelId || '',
    ...(path ? templateFieldsFromLotPath(path) : {}),
    version,
    status,
    editProgress,
    createdAt,
    updatedAt,
    sections,
    variables: [],
    generalTemplateId: options?.generalTemplateId,
    generalTemplateSyncedVersion: options?.generalTemplateSyncedVersion,
  };
}

// ─── Mock 范本数据 ─────────────────────────────────────────────────────────────

const initialTemplates: Template[] = [
  makeTpl('tpl-1', '储能电站EPC招标范本', seedLotIds.kxx, 'fw-1', 'V1.0', 'published', 100, '2024-01-20', '2024-01-25', '适用于储能电站EPC总承包项目的标准招标范本'),
  makeTpl('tpl-2', '储能电站EPC招标范本', seedLotIds.kxx, 'fw-1', 'V2.0', 'draft', 60, '2024-02-01', '2024-02-10', '增强版，补充了更详细的技术参数要求'),
  makeTpl('tpl-3', '光伏EPC工程总承包招标范本', seedLotIds.kancha, 'fw-2', 'V1.0', 'published', 100, '2024-01-22', '2024-01-28', '适用于光伏项目EPC工程总承包招标'),
  makeTpl('tpl-4', '储能系统设备采购范本', seedLotIds.cefeng, 'fw-default', 'V1.0', 'published', 80, '2024-01-18', '2024-02-05', '储能系统设备采购通用范本'),
  makeTpl('tpl-5', '前期咨询服务范本', seedLotIds.cefeng, 'fw-default', 'V1.0', 'draft', 40, '2024-02-08', '2024-02-12'),
  makeTpl('tpl-6', '海上风电EPC工程总承包范本', seedLotIds.cbsj, 'fw-default', 'V1.0', 'published', 100, '2024-01-10', '2024-01-20', '适用于海上风电工程EPC总承包招标'),
  makeTpl('tpl-7', '光伏EPC工程总承包招标范本', seedLotIds.kancha, 'fw-default', 'V1.0', 'draft', 20, '2024-02-15', '2024-02-15'),
  makeTpl('tpl-8', '陆上风电EPC工程总承包范本', seedLotIds.kxx, 'fw-default', 'V1.0', 'published', 100, '2023-12-01', '2024-01-05', '陆上风电EPC总承包招标标准范本'),
];

// ─── 状态徽章 ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Template['status'] }) {
  const map = {
    draft: { cls: 'bg-slate-100 text-slate-600', label: '草稿' },
    published: { cls: 'bg-emerald-50 text-emerald-700', label: '已发布' },
  };
  const { cls, label } = map[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function TemplateSourceBadge({ template }: { template: Template }) {
  const referenced = templateReferencesGeneralTemplate(template);
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        referenced ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {referenced ? '引用' : '自定义'}
    </span>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function TemplatePage() {
  const globalLoading = useGlobalLoading();
  const { setImmersive } = useAppShell();
  const classificationStore = useMemo(() => getClassificationStore(), []);
  const [templates, setTemplates] = useState<Template[]>(() => {
    const storedTemplates = getMockTemplates();
    if (storedTemplates.length === 0) {
      setMockTemplates(initialTemplates);
      return initialTemplates;
    }
    return storedTemplates;
  });
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingTemplateFile, setEditingTemplateFile] = useState<File | null>(null);

  useEffect(() => {
    setImmersive(!!editingTemplate);
    return () => setImmersive(false);
  }, [editingTemplate, setImmersive]);

  // 品类筛选
  const [selectedBusinessSectorId, setSelectedBusinessSectorId] = useState('');
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('');
  const [selectedLotLevelId, setSelectedLotLevelId] = useState('');
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [timeFilterCollapsed, setTimeFilterCollapsed] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // AI 搜索
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiMatchedIds, setAiMatchedIds] = useState<Set<string> | null>(null);
  const [aiMatchGroups, setAiMatchGroups] = useState<TemplateListAiMatchGroup[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 弹窗
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  /** 发布：用户确认后再执行状态变更 */
  const [templateActionConfirm, setTemplateActionConfirm] = useState<null | { type: 'publish'; id: string }>(
    null,
  );
  const [templateLogId, setTemplateLogId] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [createMeta, setCreateMeta] = useState<TemplateLotMetaValue>(emptyTemplateLotMeta);
  const [createGeneralTemplateId, setCreateGeneralTemplateId] = useState('');

  const createSelectedLotId = createMeta.lotLevelIds[0] || createMeta.lotLevelId;

  const compatibleGeneralTemplates = useMemo(
    () => listGeneralTemplates().filter(generalTemplateHasParsedContent),
    [],
  );

  useEffect(() => {
    if (!createGeneralTemplateId) return;
    if (!compatibleGeneralTemplates.some((gt) => gt.id === createGeneralTemplateId)) {
      setCreateGeneralTemplateId('');
    }
  }, [compatibleGeneralTemplates, createGeneralTemplateId]);

  const createReady = useMemo(
    () =>
      Boolean(createSelectedLotId)
      && createMeta.name.trim().length > 0
      && Boolean(createGeneralTemplateId),
    [createSelectedLotId, createMeta.name, createGeneralTemplateId],
  );

  /** 一键复制：先填品类 / 名称与描述，再生成副本 */
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [dupCascade, setDupCascade] = useState<LotCascadeValue>(emptyLotCascade);
  const [dupName, setDupName] = useState('');
  const [dupDesc, setDupDesc] = useState('');
  const [dupVersion, setDupVersion] = useState('');

  /** 编辑范本元信息 */
  const [editingMetaTemplate, setEditingMetaTemplate] = useState<Template | null>(null);
  const [editMetaCascade, setEditMetaCascade] = useState<LotCascadeValue>(emptyLotCascade);
  const [editMetaName, setEditMetaName] = useState('');
  const [editMetaDesc, setEditMetaDesc] = useState('');
  const [editMetaVersion, setEditMetaVersion] = useState('');

  // 过滤后的范本列表
  const displayedTemplates = useMemo(() => {
    let result = templates;
    if (selectedLotLevelId) {
      result = result.filter((t) => t.lotLevelId === selectedLotLevelId);
    } else if (selectedBusinessTypeId) {
      result = result.filter((t) => t.businessTypeId === selectedBusinessTypeId);
    } else if (selectedBusinessSectorId) {
      result = result.filter((t) => t.businessSectorId === selectedBusinessSectorId);
    }
    if (aiMatchedIds !== null) {
      result = result.filter(t => aiMatchedIds.has(t.id));
    }
    if (startDate) {
      result = result.filter(t => t.updatedAt >= startDate);
    }
    if (endDate) {
      result = result.filter(t => t.updatedAt <= endDate);
    }
    return sortByCreatedAtDesc(result);
  }, [
    templates,
    selectedBusinessSectorId,
    selectedBusinessTypeId,
    selectedLotLevelId,
    aiMatchedIds,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBusinessSectorId,
    selectedBusinessTypeId,
    selectedLotLevelId,
    aiMatchedIds,
    pageSize,
    startDate,
    endDate,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayedTemplates.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pagedTemplates = useMemo(
    () => displayedTemplates.slice(pageStart, pageStart + pageSize),
    [displayedTemplates, pageStart, pageSize]
  );
  const pageStartLabel = displayedTemplates.length === 0 ? 0 : pageStart + 1;
  const pageEndLabel = Math.min(pageStart + pageSize, displayedTemplates.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const templateForOperationLog = templateLogId
    ? templates.find((x) => x.id === templateLogId)
    : undefined;
  const templateLogTitle = templateForOperationLog?.name
    ? `范本操作日志 · ${templateForOperationLog.name}`
    : '范本操作日志';

  const templateLogEntries = useMemo(
    () => (templateLogId ? getTemplateAuditLogs(templateLogId) : []),
    [templateLogId],
  );

  const progressByTemplateId = useMemo(() => {
    const map = new Map<string, number>();
    templates.forEach((t) => {
      map.set(t.id, calcTemplateEditProgress(t));
    });
    return map;
  }, [templates]);

  // AI 搜索
  const handleAiSearch = async () => {
    if (!aiQuery.trim()) { setAiMatchedIds(null); setAiMatchGroups(null); return; }
    setAiSearching(true);
    try {
      await globalLoading.wrap(async () => {
        await new Promise(r => setTimeout(r, 800));
        const queryTokens = aiQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matchedTemplates = templates.filter((t) => scoreTemplateItem(aiQuery, t) > 0);
        const matched = new Set(matchedTemplates.map((t) => t.id));
        setAiMatchedIds(matched);
        setAiMatchGroups(buildAiMatchGroups(matchedTemplates, lotMetaFromTemplate, queryTokens));
      }, '正在加载中…');
    } finally {
      setAiSearching(false);
    }
  };

  const clearAiSearch = () => { setAiQuery(''); setAiMatchedIds(null); setAiMatchGroups(null); };

  const applyAiMatchGroup = (group: TemplateListAiMatchGroup) => {
    setSelectedBusinessSectorId(group.businessSectorId);
    setSelectedBusinessTypeId(group.businessTypeId);
    setSelectedLotLevelId(group.lotLevelId);
    setFilterCollapsed(false);
    // 滚动到列表区域
    setTimeout(() => {
      const listEl = document.getElementById('template-list-anchor');
      if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 操作
  const handlePublish = (id: string) => {
    setTemplates(prev => {
      const next = prev.map(t => t.id === id ? { ...t, status: 'published' as const } : t);
      setMockTemplates(next);
      const t = next.find((x) => x.id === id);
      appendDataAudit({
        scope: 'template',
        action: 'update',
        entityId: id,
        label: t?.name,
        detail: '状态变更为已发布',
        actor: getMockActor(),
      });
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setDeleteTemplateId(id);
  };

  const confirmTemplateStatusAction = () => {
    if (!templateActionConfirm) return;
    handlePublish(templateActionConfirm.id);
    setTemplateActionConfirm(null);
  };

  const confirmDeleteTemplate = () => {
    if (!deleteTemplateId) return;
    const id = deleteTemplateId;
    softDeleteTemplate(id, getMockActor());
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeleteTemplateId(null);
  };

  const handleDownload = async (template: Template) => {
    const fragments = getMockTextFragments();
    const buildExportHTML = (sections: typeof template.sections, depth = 0): string => {
      return sections.map(s => {
        const children = s.children?.length ? buildExportHTML(s.children, depth + 1) : '';
        // 与资源管理中的富文本格式（字体/字号/行距等内联样式）保持一致
        const body = resolveSectionRichHtml(s, template, fragments);
        const content = s.textFragmentId ? `<div>${body}</div>` : body;
        if (!s.title.trim()) {
          return `${content}${children}`;
        }
        const tag = depth === 0 ? 'h2' : 'h3';
        return `<${tag}>${s.title}</${tag}>${content}${children}`;
      }).join('');
    };

    const bodyHtml = buildExportHTML(template.sections);
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/1999/xhtml'>
      <head>
        <meta charset="utf-8" />
        <title>${template.name}</title>
        <style>
          body { font-family: "SimSun", "宋体", serif; font-size: 16px; line-height: 29.3px; }
          h1 { font-family: "SimHei", "黑体", sans-serif; font-size: 29.3px; font-weight: 700; text-align: center; line-height: 29.3px; margin: 22px 0; }
          h2 { font-family: "SimHei", "黑体", sans-serif; font-size: 20px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 11px 0; }
          h3 { font-family: "SimHei", "黑体", sans-serif; font-size: 18.7px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 6.6px 0; }
          h4, h5, h6 { font-family: "SimHei", "黑体", sans-serif; font-size: 16px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 6.6px 0; }
          p { font-family: "SimSun", "宋体", serif; font-size: 16px; text-align: justify; line-height: 29.3px; text-indent: 2em; margin: 0; }
          strong, b { font-family: "SimSun", "宋体", serif; font-size: 16px; font-weight: 700; }
          table { border-collapse: collapse; width: 100%; max-width: 100%; table-layout: fixed; border: 2px solid #000; margin: 0.5rem 0; }
          td, th { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; font-size: 14px; line-height: 24px; word-break: break-word; white-space: normal; }
          th { font-family: "SimHei", "黑体", sans-serif; font-weight: 700; background: #fff; border-bottom: 1.5px solid #000; }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;

    try {
      globalLoading.show('正在加载中…');
      // 优先走在线编辑回调同步后的 DOCX 文件。
      const nativeResp = await fetch(`/api/documents/${template.id}`, { method: 'GET' });
      if (nativeResp.ok) {
        const nativeBlob = await nativeResp.blob();
        // 小于该阈值通常是后端自动创建的空白文档，需回退导出。
        if (nativeBlob.size > 3000) {
          const nativeUrl = URL.createObjectURL(nativeBlob);
          const nativeLink = document.createElement('a');
          nativeLink.href = nativeUrl;
          nativeLink.download = `${template.name}.docx`;
          document.body.appendChild(nativeLink);
          nativeLink.click();
          document.body.removeChild(nativeLink);
          URL.revokeObjectURL(nativeUrl);
          return;
        }
      }

      // 回退：若尚无服务端文档稿，则使用现有 HTML->DOCX 导出。
      const blob = await asBlob(fullHtml) as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setSystemNotice('下载失败，请重试');
    } finally {
      globalLoading.hide();
    }
  };

  const cloneRemoteDocument = async (sourceId: string, targetId: string) => {
    const sourceResp = await fetch(`/api/documents/${sourceId}`, { method: 'GET' });
    if (!sourceResp.ok) {
      return;
    }
    const sourceBlob = await sourceResp.blob();
    if (sourceBlob.size <= 0) {
      return;
    }
    const content = await blobToBase64(sourceBlob);
    await fetch(`/api/documents/${targetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  };

  const handleSaveTemplate = (updated: Template) => {
    const computedProgress = calcTemplateEditProgress(updated);
    const isImported = updated.id.startsWith('import-');
    const clearGeneralTemplateSync = (prevGtId: string, templateId: string) => {
      const gt = listGeneralTemplates().find((g) => g.id === prevGtId);
      if (!gt?.templateSyncedVersion?.[templateId]) return;
      const synced = { ...gt.templateSyncedVersion };
      delete synced[templateId];
      patchGeneralTemplateManifest(prevGtId, { templateSyncedVersion: synced });
    };
    if (isImported) {
      const newId = `tpl-${Date.now()}`;
      const newTpl: Template = {
        ...updated,
        id: newId,
        name: updated.name || '导入范本',
        version: (updated.version ?? '').trim() || 'V1.0',
        status: 'draft',
        editProgress: computedProgress,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      void cloneRemoteDocument(updated.id, newId).catch((err: unknown) => {
        console.error('Failed to clone imported document:', err);
      });
      setTemplates(prev => {
        const next = [...prev, newTpl];
        setMockTemplates(next);
        syncTemplateFragmentBindingsFromSections(newTpl, getTemplateResourceInserts(newTpl.id));
        clearTemplateResourceInserts(updated.id);
        clearTemplateResourceInserts(newTpl.id);
        appendDataAudit({
          scope: 'template',
          action: 'create',
          entityId: newTpl.id,
          label: newTpl.name,
          actor: getMockActor(),
        });
        return next;
      });
    } else {
      setTemplates(prev => {
        const prevTpl = prev.find((t) => t.id === updated.id);
        const saved = { ...updated, editProgress: computedProgress };
        if (prevTpl?.generalTemplateId && !saved.generalTemplateId) {
          clearGeneralTemplateSync(prevTpl.generalTemplateId, saved.id);
        }
        const next = prev.map(t => t.id === updated.id ? saved : t);
        setMockTemplates(next);
        syncTemplateFragmentBindingsFromSections(saved, getTemplateResourceInserts(saved.id));
        clearTemplateResourceInserts(saved.id);
        appendDataAudit({
          scope: 'template',
          action: 'update',
          entityId: updated.id,
          label: updated.name,
          detail: prevTpl?.generalTemplateId && !saved.generalTemplateId
            ? '保存为自定义模版，已解除通用模版关联'
            : '保存为自定义模版',
          actor: getMockActor(),
        });
        return next;
      });
    }
    setEditingTemplate(null);
  };

  const openWpsEditor = (t: Template) => {
    setEditingTemplate(t);
  };

  const handleCloseEditor = () => {
    setEditingTemplate(null);
    setEditingTemplateFile(null);
  };

  const suggestedDupVersion = useMemo(() => {
    if (!dupCascade.lotLevelId) return 'V1.0';
    const n = templates.filter(
      (t) => t.lotLevelId === dupCascade.lotLevelId && !t.deletedAt,
    ).length;
    return `V${n + 1}.0`;
  }, [dupCascade.lotLevelId, templates]);

  const uploadComposedTemplateDocx = async (tpl: Template) => {
    const fragments = getMockTextFragments();
    const gtParsed = tpl.generalTemplateId
      ? getGeneralTemplateParsedContent(tpl.generalTemplateId)
      : null;
    const bodyHtml = buildSectionsHtmlWithResources(tpl.sections, tpl, fragments, 0, gtParsed);
    const docBlob = await asBlob(
      `<html><body>${bodyHtml || `<h1>${tpl.name}</h1>`}</body></html>`,
    ) as Blob;
    const content = await blobToBase64(docBlob);
    await fetch(`/api/documents/${encodeURIComponent(tpl.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  };

  const handleCreate = () => {
    const lotLevelId = createSelectedLotId;
    if (!lotLevelId || !createGeneralTemplateId) return;
    const name = createMeta.name.trim();
    if (!name) return;
    const now = new Date().toISOString().split('T')[0];
    const baseTs = Date.now();
    const description = createMeta.description.trim() || undefined;
    const tplId = `tpl-${baseTs}`;
    const gtParsed = getGeneralTemplateParsedContent(createGeneralTemplateId);
    if (!gtParsed) {
      setSystemNotice('所选通用模版尚未完成解析，请先在「通用模版管理」上传并等待解析完成。');
      return;
    }
    const fragments = getMockTextFragments();
    const composedSections = composeReferencedTemplateFromGeneralTemplate(
      tplId,
      lotLevelId,
      createGeneralTemplateId,
      gtParsed,
      fragments,
    );
    const tplRaw = makeTpl(
      tplId,
      name,
      lotLevelId,
      FW_MANUAL,
      suggestVersionForLot(templates, lotLevelId),
      'draft',
      0,
      now,
      now,
      description,
      {
        sections: composedSections,
        generalTemplateId: createGeneralTemplateId,
        generalTemplateSyncedVersion: gtParsed.contentVersion,
      },
    );
    const tpl = { ...tplRaw, editProgress: calcTemplateEditProgress(tplRaw) };
    setTemplates((prev) => {
      const next = [...prev, tpl];
      setMockTemplates(next);
      const gt = listGeneralTemplates().find((g) => g.id === createGeneralTemplateId);
      patchGeneralTemplateManifest(createGeneralTemplateId, {
        templateSyncedVersion: {
          ...(gt?.templateSyncedVersion ?? {}),
          [tplId]: gtParsed.contentVersion,
        },
      });
      appendDataAudit({
        scope: 'template',
        action: 'create',
        entityId: tpl.id,
        label: tpl.name,
        detail: `拼接通用模版「${gt?.name ?? createGeneralTemplateId}」生成引用型范本`,
        actor: getMockActor(),
      });
      return next;
    });
    void uploadComposedTemplateDocx(tpl).catch((err: unknown) => {
      console.warn('[TemplatePage] 新建范本后上传 docx 失败', err);
    });
    setShowCreateModal(false);
    setCreateMeta(emptyTemplateLotMeta());
    setCreateGeneralTemplateId('');
    setSystemNotice('已按所选品类与通用模版拼接生成范本；打开编辑器可预览，需固化修改时请「保存为自定义模版」。');
  };

  const openDuplicateModal = (t: Template) => {
    setDuplicateSourceId(t.id);
    setDupCascade(
      t.lotLevelId
        ? lotCascadeFromLotId(classificationStore, t.lotLevelId)
        : emptyLotCascade(),
    );
    const base = t.name.trim();
    setDupName(base ? `${base}（副本）` : '范本（副本）');
    setDupDesc(t.description ?? '');
    setDupVersion('');
  };

  const closeDuplicateModal = () => {
    setDuplicateSourceId(null);
    setDupCascade(emptyLotCascade());
    setDupName('');
    setDupDesc('');
    setDupVersion('');
  };

  const openEditMetaModal = (t: Template) => {
    setEditingMetaTemplate(t);
    setEditMetaCascade(
      t.lotLevelId
        ? lotCascadeFromLotId(classificationStore, t.lotLevelId)
        : emptyLotCascade(),
    );
    setEditMetaName(t.name);
    setEditMetaDesc(t.description ?? '');
    setEditMetaVersion(t.version ?? '');
  };

  const closeEditMetaModal = () => {
    setEditingMetaTemplate(null);
    setEditMetaCascade(emptyLotCascade());
    setEditMetaName('');
    setEditMetaDesc('');
    setEditMetaVersion('');
  };

  const handleEditMetaSave = () => {
    if (!editingMetaTemplate || !editMetaCascade.lotLevelId || !editMetaName.trim()) return;
    const path = getLotLevelPath(editMetaCascade.lotLevelId);
    if (!path) return;

    setTemplates((prev) => {
      const next = prev.map((t) => {
        if (t.id !== editingMetaTemplate.id) return t;
        return {
          ...t,
          name: editMetaName.trim(),
          description: editMetaDesc.trim() || undefined,
          ...templateFieldsFromLotPath(path),
          version: editMetaVersion.trim() || t.version,
          updatedAt: new Date().toISOString().split('T')[0],
        };
      });
      setMockTemplates(next);
      appendDataAudit({
        scope: 'template',
        action: 'update',
        entityId: editingMetaTemplate.id,
        label: editMetaName.trim(),
        detail: '修改范本属性',
        actor: getMockActor(),
      });
      return next;
    });
    closeEditMetaModal();
  };

  const confirmDuplicate = () => {
    if (!duplicateSourceId || !dupCascade.lotLevelId || !dupName.trim()) return;
    const created = duplicateMockTemplate(duplicateSourceId, {
      name: dupName.trim(),
      description: dupDesc.trim(),
      lotLevelId: dupCascade.lotLevelId,
      version: dupVersion.trim() || undefined,
    });
    if (!created) {
      setSystemNotice('复制失败：未找到源范本或品类无效，请重新选择品类。');
      closeDuplicateModal();
      return;
    }
    setTemplates(getMockTemplates());
    closeDuplicateModal();
    setSystemNotice(`已生成副本「${created.name}」，已保存为草稿，可在列表中打开编辑。`);
  };

  const templateStatusConfirmName =
    templateActionConfirm !== null
      ? templates.find((x) => x.id === templateActionConfirm.id)?.name ?? '该范本'
      : '';

  const templateStatusConfirmCopy =
    templateActionConfirm === null
      ? { title: '', message: '', tone: 'info' as const }
      : {
          title: '确认发布',
          message: `确定要发布范本「${templateStatusConfirmName}」吗？发布后状态将变为「已发布」，招标文件管理仅可选择已发布范本。`,
          tone: 'info' as const,
        };

  if (editingTemplate) {
    return (
      <WpsTemplateEditor
        template={editingTemplate}
        onBack={handleCloseEditor}
        onSave={handleSaveTemplate}
        initialFile={editingTemplateFile}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面说明（标题由 MainLayout 顶栏展示，此处不重复） */}
      <p className={systemUi.pageDesc}>基于框架生成范本，编辑内容并预留变量</p>

      <TemplateAiSearchPanel
        placeholder="用自然语言描述您需要的范本，例如：适合储能EPC项目的资格要求条款..."
        itemLabel="范本"
        query={aiQuery}
        searching={aiSearching}
        matchGroups={aiMatchGroups}
        matchedCount={aiMatchedIds?.size ?? 0}
        selectedLotLevelId={selectedLotLevelId}
        onQueryChange={setAiQuery}
        onSearch={handleAiSearch}
        onClear={clearAiSearch}
        onApplyGroup={applyAiMatchGroup}
      />

      <TemplateCategoryFilterPanel
        store={classificationStore}
        value={{
          businessSectorId: selectedBusinessSectorId,
          businessTypeId: selectedBusinessTypeId,
          lotLevelId: selectedLotLevelId,
        }}
        onChange={(next) => {
          setSelectedBusinessSectorId(next.businessSectorId);
          setSelectedBusinessTypeId(next.businessTypeId);
          setSelectedLotLevelId(next.lotLevelId);
        }}
        collapsed={filterCollapsed}
        onCollapsedChange={setFilterCollapsed}
      />

      <TemplateUpdatedTimeFilterPanel
        value={{ startDate, endDate }}
        onChange={(next) => {
          setStartDate(next.startDate);
          setEndDate(next.endDate);
        }}
        collapsed={timeFilterCollapsed}
        onCollapsedChange={setTimeFilterCollapsed}
        hint="按范本更新时间进行区间过滤（包含起止日期）"
      />

      {/* 工具栏 */}
      <div className="flex items-center gap-3">
        <TemplateListActiveFilterTags
          store={classificationStore}
          categoryFilter={{
            businessSectorId: selectedBusinessSectorId,
            businessTypeId: selectedBusinessTypeId,
            lotLevelId: selectedLotLevelId,
          }}
          timeFilter={{ startDate, endDate }}
          onClearCategory={() => {
            setSelectedBusinessSectorId('');
            setSelectedBusinessTypeId('');
            setSelectedLotLevelId('');
          }}
        />
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => {
              setCreateMeta(emptyTemplateLotMeta());
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建范本
          </button>
        </div>
      </div>

      {/* 范本表格 */}
      <div id="template-list-anchor" className={systemUi.card}>
        <table className={`${systemUi.table} table-fixed`}>
          <thead className="sticky top-0 z-10">
            <tr className={systemUi.tableHeadRow}>
              <th className={`${systemUi.tableTh} w-[20%]`}>范本名称</th>
              <th className={`${systemUi.tableTh} w-[18%]`}>所属品类</th>
              <th className={`${systemUi.tableTh} w-[10%]`}>是否引用</th>
              <th className={`${systemUi.tableTh} w-[12%]`}>编辑进度</th>
              <th className={`${systemUi.tableTh} w-[9%]`}>状态</th>
              <th className={`${systemUi.tableTh} w-[12%]`}>更新时间</th>
              <th className={`${systemUi.tableTh} w-[19%] text-right`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedTemplates.length === 0 ? (
              <tr>
                <td colSpan={7} className={systemUi.tableEmpty}>
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>暂无范本</p>
                </td>
              </tr>
            ) : (
              pagedTemplates.map(t => {
                const progress = progressByTemplateId.get(t.id) ?? 0;
                return (
                  <tr
                    key={t.id}
                    className={`${systemUi.tableRow} ${
                      aiMatchedIds?.has(t.id) ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : ''
                    }`}
                  >
                  <td className={systemUi.tableTd}>
                    <div className="text-sm font-medium text-slate-900 truncate">{t.name}</div>
                    {t.description?.trim() && (
                      <SystemTooltip content={t.description} placement="top">
                        <span className="block text-[11px] leading-tight text-slate-500 line-clamp-1 truncate cursor-default mt-0.5">
                          {previewTableText(t.description)}
                        </span>
                      </SystemTooltip>
                    )}
                  </td>
                  <td className={systemUi.tableTd}>
                    <div className="text-sm font-medium text-slate-900 truncate">{t.lotLevelName}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {t.businessSectorName} · {t.businessTypeDisplayName}
                    </div>
                  </td>
                  <td className={`${systemUi.tableTd} whitespace-nowrap`}>
                    <TemplateSourceBadge template={t} />
                  </td>
                  <td className={systemUi.tableTd}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right tabular-nums">{progress}%</span>
                    </div>
                  </td>
                  <td className={`${systemUi.tableTd} whitespace-nowrap`}><StatusBadge status={t.status} /></td>
                  <td className={`${systemUi.tableTdMuted} whitespace-nowrap tabular-nums`}>{t.updatedAt}</td>
                  <td className={`${systemUi.tableTd} text-right`}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" title="编辑" onClick={() => openWpsEditor(t)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDuplicateModal(t)}
                        className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                        title="一键复制（含正文与文本插入关系）"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMetaModal(t)}
                        className="p-1.5 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                        title="编辑范本信息"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      {t.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setTemplateActionConfirm({ type: 'publish', id: t.id })}
                          className="p-1.5 rounded hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="发布"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDownload(t)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" title="下载">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTemplateLogId(t.id);
                        }}
                        className="p-1.5 rounded hover:bg-violet-50 text-slate-500 hover:text-violet-700 transition-colors cursor-pointer"
                        title="操作日志"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors cursor-pointer" title="删除">
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
            显示第 {pageStartLabel}-{pageEndLabel} 条，共 {displayedTemplates.length} 条
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>每页</span>
              <FormSelect
                selectSize="xs"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-2 text-xs text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新建范本弹窗 */}
      {showCreateModal && (
        <ModalOverlay>
          <div className={systemUi.modalPanel} style={{ width: '56rem', maxWidth: 'calc(100vw - 2rem)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">新建范本</h3>
              <button onClick={() => { setShowCreateModal(false); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <TemplateLotMetaFields
                value={createMeta}
                onChange={setCreateMeta}
                store={classificationStore}
                hideVersion
                parseFromDescription
                autoGenerateName
              />
              {createSelectedLotId && (
                <div className="mt-4 space-y-2">
                  <label className="block text-xs font-medium text-slate-600">
                    选择通用模版 <span className="text-rose-500">*</span>
                  </label>
                  <FormSelect
                    value={createGeneralTemplateId}
                    onChange={(e) => setCreateGeneralTemplateId(e.target.value)}
                    disabled={compatibleGeneralTemplates.length === 0}
                  >
                    <option value="">请选择通用模版</option>
                    {compatibleGeneralTemplates.map((gt) => (
                      <option key={gt.id} value={gt.id}>
                        {gt.name}（{gt.outlineSectionCount ?? 0} 章 / {gt.paragraphCount ?? 0} 段）
                      </option>
                    ))}
                  </FormSelect>
                  {compatibleGeneralTemplates.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      暂无可用的通用模版；请先在「通用模版管理」上传并完成解析后再新建范本。
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      确认后将按所选品类与通用模版<strong className="font-medium text-slate-700">立即拼接</strong>生成引用型范本；编辑器内修改需点击「保存为自定义模版」才会固化并脱离模版关联。
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
              <button
                onClick={handleCreate}
                disabled={!createReady}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成拼接范本
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 复制范本：确认品类 / 名称与描述后再生成 */}
      {duplicateSourceId && (
        <ModalOverlay>
          <div className={systemUi.modalPanel}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">复制范本</h3>
                <p className="text-xs text-slate-500 mt-0.5">请重新选择业务板块与品类，并确认范本名称与描述后生成副本（正文与资源插入关系一并保留）。</p>
              </div>
              <button type="button" onClick={closeDuplicateModal} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <LotCascadeFields
                value={dupCascade}
                onChange={setDupCascade}
                store={classificationStore}
                required
              />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  范本名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  placeholder="请输入副本名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本描述</label>
                <textarea
                  value={dupDesc}
                  onChange={(e) => setDupDesc(e.target.value)}
                  placeholder="请输入范本描述"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
                <input
                  type="text"
                  value={dupVersion}
                  onChange={(e) => setDupVersion(e.target.value)}
                  placeholder="如 V1.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={closeDuplicateModal}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDuplicate}
                disabled={!dupCascade.lotLevelId || !dupName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确定并生成副本
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <SystemDialog
        open={templateActionConfirm !== null}
        title={templateStatusConfirmCopy.title}
        message={templateStatusConfirmCopy.message}
        tone={templateStatusConfirmCopy.tone}
        variant="confirm"
        onClose={() => setTemplateActionConfirm(null)}
        onConfirm={confirmTemplateStatusAction}
      />

      <SystemDialog
        open={deleteTemplateId !== null}
        title="确认删除"
        message="确定要删除此范本吗？"
        tone="danger"
        variant="confirm"
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={confirmDeleteTemplate}
      />

      <SystemDialog
        open={systemNotice !== null}
        title="系统提示"
        message={systemNotice ?? ''}
        onClose={() => setSystemNotice(null)}
        onConfirm={() => setSystemNotice(null)}
      />

      <OperationLogDialog
        open={templateLogId !== null}
        onClose={() => setTemplateLogId(null)}
        title={templateLogTitle}
        entries={templateLogEntries}
      />

      {/* 编辑范本信息弹窗 */}
      {editingMetaTemplate && (
        <ModalOverlay>
          <div className={systemUi.modalPanel}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">编辑范本信息</h3>
              <button onClick={closeEditMetaModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <LotCascadeFields
                value={editMetaCascade}
                onChange={setEditMetaCascade}
                store={classificationStore}
                required
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本名称 <span className="text-rose-500">*</span></label>
                <input type="text" value={editMetaName} onChange={e => setEditMetaName(e.target.value)}
                  placeholder="请输入范本名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
                <input
                  type="text"
                  value={editMetaVersion}
                  onChange={(e) => setEditMetaVersion(e.target.value)}
                  placeholder="如 V1.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本描述</label>
                <textarea value={editMetaDesc} onChange={e => setEditMetaDesc(e.target.value)}
                  placeholder="请输入范本描述" rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeEditMetaModal} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
              <button onClick={handleEditMetaSave} disabled={!editMetaCascade.lotLevelId || !editMetaName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                保存
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
}

