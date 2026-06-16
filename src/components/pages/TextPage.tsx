'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  X,
  FileText,
  Edit3,
  Trash2,
  ClipboardList,
  Globe,
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Link2,
} from 'lucide-react';
import type { TextFragment, TextVersion } from '@/types';
import { seedLotIds } from '@/lib/classification/seed-lot-ids';
import {
  getMockTextFragments,
  setMockTextFragments,
  softDeleteTextFragment,
  syncTextFragmentToAllTemplates,
  getFragmentTemplateUsage,
} from '@/lib/mockData';
import { LotScopePicker } from '@/components/resource/LotScopePicker';
import { appendDataAudit, getMockActor, getTextAuditLogs } from '@/lib/dataAudit';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { OperationLogDialog } from '@/components/ui/OperationLogDialog';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import { FormSelect } from '@/components/ui/FormSelect';
import { getClassificationStore, prepareTextFragmentLotScope } from '@/lib/classification';
import { buildResourcePreviewHtml } from '@/lib/resourcePreviewHtml';
import { extractResourceEmbedLabelsFromHtml } from '@/lib/resourceEmbedLabels';
import dynamic from 'next/dynamic';
import type { RichTextEditorHandle } from '@/components/RichTextEditor';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

const MODULE_TAG: Record<string, string> = {
  text: '文本',
  qualification: '资格',
  evaluation: '评标',
  'contract-clause': '合同',
};

/** 文本管理中「资源插入」可选类型（不含文本库本身） */
type EmbedModuleFilter = 'all' | 'qualification' | 'evaluation' | 'contract-clause';

const EMBED_MODULE_FILTER_OPTIONS: { value: EmbedModuleFilter; label: string }[] = [
  { value: 'all', label: '全部（资格 / 评标 / 合同）' },
  { value: 'qualification', label: '资格条件' },
  { value: 'evaluation', label: '评标办法' },
  { value: 'contract-clause', label: '合同条款' },
];

function collectEligibleEmbedFragments(
  allFragments: TextFragment[],
  editing: TextFragment | null,
  newUniversal: boolean,
  newCategoryIds: string[],
): TextFragment[] {
  const currentId = editing?.id ?? null;
  const scopeUniversal = editing
    ? (editing.applicableToAllLotLevels ?? editing.applicableToAllCategories) !== false
    : newUniversal;
  const scopeIds = editing
    ? (editing.applicableLotLevelIds ?? editing.applicableCategoryIds ?? [])
    : newCategoryIds;

  return allFragments.filter((f) => {
    if (f.deletedAt) return false;
    if (currentId && f.id === currentId) return false;
    if (scopeUniversal) return true;
    if ((f.applicableToAllLotLevels ?? f.applicableToAllCategories) !== false) return true;
    const oids = f.applicableLotLevelIds ?? f.applicableCategoryIds ?? [];
    return oids.some((id) => scopeIds.includes(id));
  });
}

// ─── Mock 文本数据 ─────────────────────────────────────────────────────────────

const mockTexts: TextFragment[] = [
  {
    id: 'txt-1',
    name: '标准资格要求条款',
    module: 'qualification',
    content: '<h2>一、基本资格条件</h2><p>投标人应具备以下资格条件：</p><ol><li>具有独立法人资格；</li><li>具有良好的商业信誉和健全的财务会计制度；</li><li>具有履行合同所必需的设备和专业技术能力；</li><li>具有依法缴纳税收和社会保障资金的良好记录；</li><li>参加本次招标活动前三年内，在经营活动中没有重大违法记录。</li></ol>',
    description: '适用于各类招标项目的通用资格要求',
    createdAt: '2024-01-10',
    updatedAt: '2024-03-15',
    contentVersion: 2,
    templateSyncedVersion: { 'tpl-1': 1 },
    versions: [
      {
        content:
          '<h2>一、基本资格条件</h2><p>投标人应具备以下资格条件：</p><ol><li>具有独立法人资格；</li><li>具有良好的商业信誉和健全的财务会计制度；</li><li>具有履行合同所必需的设备和专业技术能力；</li></ol>',
        updatedAt: '2024-01-15',
      },
    ],
    bindings: [
      {
        id: 'bind-1',
        textFragmentId: 'txt-1',
        templateId: 'tpl-1',
        templateSectionId: 'sec-fw-1-ch-1-2',
        templateName: '储能电站EPC招标范本',
        sectionTitle: '1.2 资格要求',
        order: 1,
      },
    ],
  },
  {
    id: 'txt-2',
    name: '投标文件密封要求',
    module: 'text',
    content:
      '<h2>密封要求（修订版）</h2><p>投标文件应按以下要求密封：</p><ol><li>投标文件正本和副本应分别密封，并在封套上标明"正本"或"副本"字样；</li><li>封套上应注明招标项目名称、投标人名称和地址；</li><li>封套应加盖投标人公章；</li><li>未按要求密封的投标文件，招标人有权拒收；</li><li>电子投标文件应按要求进行加密上传。</li></ol>',
    description: '投标文件密封的标准要求',
    applicableToAllLotLevels: false,
    applicableLotLevelIds: [seedLotIds.kxx],
    createdAt: '2024-01-12',
    updatedAt: '2024-04-18',
    contentVersion: 1,
    templateSyncedVersion: {},
    versions: [
      {
        content:
          '<h2>密封要求</h2><p>投标文件应按以下要求密封：</p><ol><li>投标文件正本和副本应分别密封；</li><li>封套上应注明招标项目名称、投标人名称和地址；</li></ol>',
        updatedAt: '2024-01-18',
      },
    ],
    bindings: [
      {
        id: 'bind-3',
        textFragmentId: 'txt-2',
        templateId: 'tpl-1',
        templateSectionId: 'sec-fw-1-ch-2-2',
        templateName: '储能电站EPC招标范本',
        sectionTitle: '2.2 投标文件要求',
        order: 1,
      },
    ],
  },
];

// ─── 主页面 ───────────────────────────────────────────────────────────────────

interface TextPageProps {
  moduleName?: string;
  moduleKey?: 'text' | 'qualification' | 'evaluation' | 'contract-clause';
  /** 保存时自动同步到所有引用范本（资格条件/评标办法/合同条款默认开启，文本管理需手动同步） */
  autoSyncOnSave?: boolean;
}

export default function TextPage({ moduleName = '文本', moduleKey = 'text', autoSyncOnSave = false }: TextPageProps) {
  /** 仅文本管理保留「资源插入」；其余资源模块不展示该能力 */
  const isTextModulePage = moduleKey === 'text';

  const [allTexts, setAllTexts] = useState<TextFragment[]>(() => {
    const stored = getMockTextFragments();
    return stored.length > 0 ? stored : mockTexts;
  });
  const [selectedText, setSelectedText] = useState<TextFragment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingText, setEditingText] = useState<TextFragment | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '', description: '' });
  /** 适用标段范围（与招采分类管理叶子标段一致） */
  const [applicableToAllLotLevels, setApplicableToAllLotLevels] = useState(true);
  const [applicableLotLevelIds, setApplicableLotLevelIds] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState<string | null>(null);
  /** 每次打开新建/编辑弹窗递增，用于强制重挂 LotScopePicker，避免展开态被 React 复用 */
  const [categoryPickerEpoch, setCategoryPickerEpoch] = useState(0);

  const richEditorRef = useRef<RichTextEditorHandle>(null);
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [embedSearch, setEmbedSearch] = useState('');
  const [embedSelectedIds, setEmbedSelectedIds] = useState<Set<string>>(new Set());
  const [embedModuleFilter, setEmbedModuleFilter] = useState<EmbedModuleFilter>('all');

  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);

  const scopeInsertReady = applicableToAllLotLevels || applicableLotLevelIds.length > 0;

  const eligibleEmbedFragments = useMemo(() => {
    if (!isTextModulePage) return [];
    const raw = collectEligibleEmbedFragments(
      allTexts.filter((t) => !t.deletedAt),
      editingText,
      applicableToAllLotLevels,
      applicableLotLevelIds,
    );
    const nonTextResources = raw.filter((f) => (f.module ?? 'text') !== 'text');
    const byModule =
      embedModuleFilter === 'all'
        ? nonTextResources
        : nonTextResources.filter((f) => (f.module ?? 'text') === embedModuleFilter);
    return sortByCreatedAtDesc(byModule);
  }, [
    isTextModulePage,
    allTexts,
    editingText,
    applicableToAllLotLevels,
    applicableLotLevelIds,
    embedModuleFilter,
  ]);

  const filteredEligibleEmbeds = useMemo(() => {
    const q = embedSearch.trim().toLowerCase();
    if (!q) return eligibleEmbedFragments;
    return eligibleEmbedFragments.filter(
      (f) =>
        f.name.toLowerCase().includes(q)
        || (f.description && f.description.toLowerCase().includes(q)),
    );
  }, [eligibleEmbedFragments, embedSearch]);

  useEffect(() => {
    setEmbedSelectedIds(new Set());
  }, [embedModuleFilter]);

  const classificationStore = useMemo(() => getClassificationStore(), []);
  const lotIdToName = useMemo(() => {
    const m = new Map<string, string>();
    classificationStore.lotLevels.forEach((lot) => m.set(lot.id, lot.name));
    return m;
  }, [classificationStore]);

  const [deleteTextId, setDeleteTextId] = useState<string | null>(null);
  const [textLogId, setTextLogId] = useState<string | null>(null);
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const isTextInModule = (text: TextFragment) => (text.module ?? 'text') === moduleKey;

  const texts = useMemo(
    () => allTexts.filter((text) => (text.module ?? 'text') === moduleKey),
    [allTexts, moduleKey],
  );

  const updateTexts = (updater: TextFragment[] | ((prev: TextFragment[]) => TextFragment[])) => {
    setAllTexts((prevAll) => {
      const prevModuleTexts = prevAll.filter((text) => isTextInModule(text));
      const nextModuleTexts =
        typeof updater === 'function'
          ? (updater as (prev: TextFragment[]) => TextFragment[])(prevModuleTexts)
          : updater;
      const others = prevAll.filter((text) => !isTextInModule(text));
      const nextAll = [...others, ...nextModuleTexts];
      setMockTextFragments(nextAll);
      return nextAll;
    });
  };

  const textForOperationLog = textLogId ? texts.find((t) => t.id === textLogId) : undefined;
  const textLogTitle = textForOperationLog?.name
    ? `资源操作日志 · ${textForOperationLog.name}`
    : '资源操作日志';
  const textLogEntries = useMemo(
    () => (textLogId ? getTextAuditLogs(textLogId) : []),
    [textLogId],
  );

  const selectedUsage = useMemo(
    () => (selectedText ? getFragmentTemplateUsage(selectedText) : null),
    [selectedText],
  );

  /** 挂载后再剥离/注入预览用表格边框（避免 SSR 与首帧不一致）；useLayoutEffect 尽量赶在绘制前 */
  const [previewStripReady, setPreviewStripReady] = useState(false);
  useLayoutEffect(() => {
    setPreviewStripReady(true);
  }, []);

  const resourcePreviewHtml = useMemo(
    () => buildResourcePreviewHtml(selectedText?.content ?? '', previewStripReady),
    [selectedText?.content, previewStripReady],
  );

  /** 正文内资源嵌入占位名称（预览标题行展示） */
  const embeddedResourceLabels = useMemo(
    () => extractResourceEmbedLabelsFromHtml(selectedText?.content ?? ''),
    [selectedText?.content],
  );

  const filteredTexts = useMemo(() => {
    const filtered = texts.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );
    return sortByCreatedAtDesc(filtered);
  }, [texts, searchQuery]);

  const listTotalPages = Math.max(1, Math.ceil(filteredTexts.length / listPageSize));
  const safeListPage = Math.min(listPage, listTotalPages);
  const listPageStart = (safeListPage - 1) * listPageSize;
  const pagedTexts = useMemo(
    () => filteredTexts.slice(listPageStart, listPageStart + listPageSize),
    [filteredTexts, listPageStart, listPageSize],
  );
  const listPageStartLabel = filteredTexts.length === 0 ? 0 : listPageStart + 1;
  const listPageEndLabel = Math.min(listPageStart + listPageSize, filteredTexts.length);

  useEffect(() => {
    setListPage(1);
  }, [searchQuery, moduleKey]);

  useEffect(() => {
    if (listPage > listTotalPages) {
      setListPage(listTotalPages);
    }
  }, [listPage, listTotalPages]);

  useEffect(() => {
    if (!selectedText) return;
    if (!texts.some((t) => t.id === selectedText.id)) {
      setSelectedText(null);
    }
  }, [selectedText, texts]);

  useEffect(() => {
    setUsageExpanded(false);
  }, [selectedText?.id]);

  const openCreateModal = () => {
    setEmbedModalOpen(false);
    setEmbedModuleFilter('all');
    setEditingText(null);
    setFormData({ name: '', content: '', description: '' });
    setApplicableToAllLotLevels(true);
    setApplicableLotLevelIds([]);
    setScopeError(null);
    setCategoryPickerEpoch((n) => n + 1);
    setShowCreateModal(true);
  };

  const openEditModal = (text: TextFragment) => {
    setEmbedModalOpen(false);
    setEmbedModuleFilter('all');
    setEditingText(text);
    setFormData({
      name: text.name,
      content: text.content ?? '',
      description: text.description || ''
    });
    setApplicableToAllLotLevels(
      (text.applicableToAllLotLevels ?? text.applicableToAllCategories) !== false,
    );
    setApplicableLotLevelIds(text.applicableLotLevelIds ?? text.applicableCategoryIds ?? []);
    setScopeError(null);
    setCategoryPickerEpoch((n) => n + 1);
    setShowCreateModal(true);
  };

  const scopePayload = () =>
    prepareTextFragmentLotScope({
      applicableToAllLotLevels,
      applicableLotLevelIds: applicableToAllLotLevels ? [] : [...applicableLotLevelIds],
    });

  const validateScope = () => {
    if (!applicableToAllLotLevels && applicableLotLevelIds.length === 0) {
      setScopeError('请勾选「通用（全部标段）」，或取消通用后至少选择一个标段');
      return false;
    }
    setScopeError(null);
    return true;
  };

  const formatScopeSummary = (text: TextFragment) => {
    if ((text.applicableToAllLotLevels ?? text.applicableToAllCategories) !== false) {
      return '通用（全部标段）';
    }
    const ids = text.applicableLotLevelIds ?? text.applicableCategoryIds ?? [];
    if (ids.length === 0) {
      return '未指定标段（范本侧栏不展示）';
    }
    return ids.map((id) => lotIdToName.get(id) || id).join('、');
  };

  /** 保存资源正文：递增 contentVersion；范本侧正文需另行「同步到所有范本」 */
  const handleSave = () => {
    if (!formData.name.trim() || !formData.content.trim()) return;
    if (!validateScope()) return;
    const now = new Date().toISOString().split('T')[0];
    const scope = scopePayload();

    if (editingText) {
      const prevCv = editingText.contentVersion ?? 1;
      const nextCv = prevCv + 1;
      updateTexts((prev) =>
        prev.map((t) => {
          if (t.id !== editingText.id) return t;
          const newVersions: TextVersion[] = t.content
            ? [{ content: t.content, updatedAt: t.updatedAt }, ...t.versions].slice(0, 10)
            : t.versions;
          return {
            ...t,
            ...scope,
            name: formData.name,
            content: formData.content,
            description: formData.description,
            updatedAt: now,
            contentVersion: nextCv,
            versions: newVersions,
          };
        }),
      );
      if (selectedText?.id === editingText.id) {
        setSelectedText((prev) => {
          if (!prev) return null;
          const newVersions: TextVersion[] = prev.content
            ? [{ content: prev.content, updatedAt: prev.updatedAt }, ...prev.versions].slice(0, 10)
            : prev.versions;
          return {
            ...prev,
            ...scope,
            name: formData.name,
            content: formData.content,
            description: formData.description,
            updatedAt: now,
            contentVersion: nextCv,
            versions: newVersions,
          };
        });
      }
      appendDataAudit({
        scope: 'text',
        action: 'update',
        entityId: editingText.id,
        label: formData.name,
        detail: '保存',
        actor: getMockActor(),
      });
    } else {
      const newText: TextFragment = {
        id: `txt-${Date.now()}`,
        module: moduleKey,
        ...scope,
        name: formData.name,
        content: formData.content,
        description: formData.description,
        createdAt: now,
        updatedAt: now,
        versions: [],
        bindings: [],
        contentVersion: 1,
        templateSyncedVersion: {},
      };
      updateTexts((prev) => [...prev, newText]);
      appendDataAudit({
        scope: 'text',
        action: 'create',
        entityId: newText.id,
        label: newText.name,
        actor: getMockActor(),
      });
    }
    setEmbedModalOpen(false);
    setEmbedModuleFilter('all');
    setShowCreateModal(false);

    // 资格条件/评标办法/合同条款：保存后自动同步到所有引用范本
    if (autoSyncOnSave && editingText) {
      try {
        syncTextFragmentToAllTemplates(editingText.id);
        const next = getMockTextFragments();
        setAllTexts(next);
        const u = next.find((t) => t.id === editingText.id);
        if (u) setSelectedText(u);
      } catch {
        // 静默失败，不影响保存主流程
      }
    }
  };

  const closeCreateModal = () => {
    setEmbedModalOpen(false);
    setEmbedModuleFilter('all');
    setShowCreateModal(false);
  };

  const handleSyncAllTemplates = () => {
    if (!selectedText) return;
    setSyncingAll(true);
    try {
      syncTextFragmentToAllTemplates(selectedText.id);
      const next = getMockTextFragments();
      setAllTexts(next);
      const u = next.find((t) => t.id === selectedText.id);
      if (u) setSelectedText(u);
    } finally {
      setSyncingAll(false);
    }
  };

  const confirmDeleteText = () => {
    if (!deleteTextId) return;
    const id = deleteTextId;
    softDeleteTextFragment(id, getMockActor());
    setAllTexts((prev) => prev.filter((t) => t.id !== id));
    if (selectedText?.id === id) setSelectedText(null);
    setDeleteTextId(null);
  };

  return (
    <div className="flex gap-6 h-full">
      {/* 左侧：文本列表 */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">{moduleName}列表</h2>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              新建{moduleName}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`搜索${moduleName}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {filteredTexts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs">暂无{moduleName}</p>
            </div>
          ) : (
            pagedTexts.map((text) => {
              const rowUsage = getFragmentTemplateUsage(text);
              const scopeUniversal = (text.applicableToAllLotLevels ?? text.applicableToAllCategories) !== false;
              return (
              <div
                key={text.id}
                onClick={() => setSelectedText(text)}
                className={`w-full rounded-lg mb-1 transition-colors cursor-pointer p-3 text-left ${
                  selectedText?.id === text.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-sm font-medium leading-snug flex-1 ${selectedText?.id === text.id ? 'text-blue-700' : 'text-slate-800'}`}>
                    {text.name}
                  </span>
                </div>
                {text.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{text.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      scopeUniversal
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-violet-50 text-violet-700'
                    }`}
                  >
                    {scopeUniversal ? (
                      <>
                        <Globe className="w-3 h-3" />
                        通用
                      </>
                    ) : (
                      <>
                        <Boxes className="w-3 h-3" />
                        指定范围
                      </>
                    )}
                  </span>
                  {rowUsage.rows.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 shrink-0">
                      {rowUsage.rows.length} 个范本引用
                    </span>
                  )}
                  {rowUsage.pendingCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
                      {rowUsage.pendingCount} 个待同步
                    </span>
                  )}
                </div>
              </div>
            );
            })
          )}
        </div>

        {filteredTexts.length > 0 && (
          <div className="shrink-0 border-t border-slate-100 px-3 py-2.5 space-y-2 bg-slate-50/80">
            <p className="text-[10px] text-slate-500 leading-snug">
              第 {listPageStartLabel}–{listPageEndLabel} 条，共 {filteredTexts.length} 条
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <span>每页</span>
                <FormSelect
                  selectSize="xs"
                  value={listPageSize}
                  onChange={(e) => {
                    setListPageSize(Number(e.target.value));
                    setListPage(1);
                  }}
                  wrapperClassName="w-[3.25rem]"
                >
                  {[5, 10, 20].map((size) => (
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
                  className="px-2 py-1 text-[10px] border border-slate-200 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="px-1 text-[10px] text-slate-600 tabular-nums">
                  {safeListPage}/{listTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                  disabled={safeListPage >= listTotalPages}
                  className="px-2 py-1 text-[10px] border border-slate-200 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：文本详情 */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {selectedText ? (
          <>
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">{selectedText.name}</h2>
                  {selectedText.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{selectedText.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-100">
                      <span className="font-medium text-slate-600">适用范围</span>
                      {(selectedText.applicableToAllLotLevels ?? selectedText.applicableToAllCategories) !== false ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-700">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          通用（全部标段）
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-violet-700">
                          <Boxes className="w-3.5 h-3.5 shrink-0" />
                          {formatScopeSummary(selectedText)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTextLogId(selectedText.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    操作日志
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedText)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    编辑内容
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTextId(selectedText.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-slate-100">
                <div className="flex w-full flex-nowrap items-center gap-y-2 overflow-x-auto px-6 py-3 hover:bg-slate-50/80 transition-colors">
                  {/* 工具栏惯例：标题与统计标签紧邻；仅在「统计」与「操作按钮」之间弹性留白，操作贴右，不会在标题与数字之间拉长 */}
                  <div
                    className="flex min-w-0 max-w-full shrink-0 flex-nowrap items-center overflow-x-auto text-[13px] leading-snug"
                    style={{ columnGap: 'clamp(0.75rem, 2vw, 1rem)' }}
                  >
                    <span className="text-sm font-semibold text-slate-800 shrink-0 tracking-tight">
                      范本使用统计
                    </span>
                    {selectedUsage && selectedUsage.pendingCount > 0 && (
                      <span className="inline-flex shrink-0 items-center text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                        {selectedUsage.pendingCount} 个待同步
                      </span>
                    )}
                    {selectedUsage && (
                      <span className="inline-flex shrink-0 items-center text-[11px] px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                        {selectedUsage.rows.length} 个范本引用
                      </span>
                    )}
                  </div>
                  <div className="min-h-px min-w-4 flex-1 basis-0" aria-hidden />
                  <div className="flex shrink-0 items-center gap-2">
                    {!autoSyncOnSave && selectedUsage && (
                      <button
                        type="button"
                        disabled={
                          syncingAll
                          || selectedUsage.rows.length === 0
                          || selectedUsage.pendingCount === 0
                        }
                        onClick={handleSyncAllTemplates}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {syncingAll ? '同步中…' : '同步到所有范本'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setUsageExpanded((v) => !v)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      aria-expanded={usageExpanded}
                      aria-label={usageExpanded ? '收起' : '展开'}
                    >
                      {usageExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {usageExpanded && selectedUsage && (
                  <div className="px-6 pb-4 space-y-3">
                    {selectedUsage.rows.length === 0 ? (
                      <p className="text-xs text-slate-500">暂无范本引用本资源。</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedUsage.rows.map((row) => (
                          <li
                            key={row.templateId}
                            className="flex items-center justify-between gap-3 text-sm border border-slate-100 rounded-lg px-3 py-2.5 bg-slate-50/50"
                          >
                            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                              <span className="text-slate-800 font-medium truncate">{row.templateName}</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {row.businessSectorName && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {row.businessSectorName}
                                  </span>
                                )}
                                {row.businessTypeDisplayName && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {row.businessTypeDisplayName}
                                  </span>
                                )}
                                {row.lotLevelName && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                    {row.lotLevelName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {row.synced ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  已同步
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  待同步
                                </span>
                              )}
                              {row.referencedAt ? (
                                <span className="text-[11px] text-slate-400">引用于 {row.referencedAt}</span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-slate-500 leading-relaxed">
                      在范本编辑器侧栏插入并与小节关联；保存资源不会自动改写范本内正文，请在此按需同步。
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {moduleName}内容
                    </h3>
                    {embeddedResourceLabels.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide shrink-0">
                          资源插入
                        </span>
                        <div className="flex flex-wrap gap-1.5 min-w-0">
                          {embeddedResourceLabels.map((label, idx) => (
                            <span
                              key={`${label}-${idx}`}
                              className="inline-flex max-w-full items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 truncate"
                              title={label}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 pt-0.5">
                    最后编辑 {selectedText.updatedAt}
                  </span>
                </div>
                <div
                  className="resource-rich-preview max-w-none text-sm text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: resourcePreviewHtml,
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">从左侧选择一个{moduleName}查看详情</p>
            </div>
          </div>
        )}
      </div>

      {/* 创建/编辑文本弹窗 */}
      {showCreateModal && (
        <ModalOverlay>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h3 className="text-base font-semibold text-slate-900">
                {editingText ? `编辑${moduleName}` : `新建${moduleName}`}
              </h3>
              <button type="button" onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
              {isTextModulePage && embedModalOpen && (
                <div className="absolute inset-0 z-10 flex flex-col bg-white">
                  <div className="shrink-0 px-6 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setEmbedModalOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
                        aria-label="返回编辑"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm font-semibold text-slate-900">资源插入</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmbedModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 shrink-0 p-1"
                      aria-label="关闭"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="px-6 pt-3 text-xs text-slate-500 leading-relaxed shrink-0">
                    可选除当前资源外的<strong className="font-medium text-slate-700">资格条件 / 评标办法 / 合同条款</strong>
                    资源（不含文本库）。通用列出全部；指定范围仅列出与当前标段范围有交集的条目。插入后在正文显示
                    <strong className="font-medium text-slate-700">名称占位</strong>
                    ，范本中按标段解析正文。
                  </p>
                  <div className="px-6 pt-3 shrink-0">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">资源类型</label>
                    <FormSelect
                      value={embedModuleFilter}
                      onChange={(e) => setEmbedModuleFilter(e.target.value as EmbedModuleFilter)}
                      wrapperClassName="max-w-md"
                    >
                      {EMBED_MODULE_FILTER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </FormSelect>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      文本库资源不予列出；请在对应资源模块中维护正文。
                    </p>
                  </div>
                  <div className="px-6 pt-2 shrink-0">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={embedSearch}
                        onChange={(e) => setEmbedSearch(e.target.value)}
                        placeholder="按名称查询…"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() =>
                          setEmbedSelectedIds(new Set(filteredEligibleEmbeds.map((f) => f.id)))}
                      >
                        全选可见项
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:underline"
                        onClick={() => setEmbedSelectedIds(new Set())}
                      >
                        清除
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-2">
                    {filteredEligibleEmbeds.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        {eligibleEmbedFragments.length === 0
                          ? '暂无可插入的其它资源（或请先保存标段范围）。'
                          : '没有符合筛选条件的资源。'}
                      </p>
                    ) : (
                      filteredEligibleEmbeds.map((f) => (
                        <label
                          key={f.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 rounded border-slate-300 text-blue-600"
                            checked={embedSelectedIds.has(f.id)}
                            onChange={(e) => {
                              setEmbedSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(f.id);
                                else next.delete(f.id);
                                return next;
                              });
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">{f.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {MODULE_TAG[f.module ?? 'text']}
                              </span>
                              {(f.applicableToAllLotLevels ?? f.applicableToAllCategories) !== false ? (
                                <span className="text-[10px] text-blue-600">通用</span>
                              ) : (
                                <span className="text-[10px] text-violet-600">指定范围</span>
                              )}
                            </div>
                            {f.description ? (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{f.description}</p>
                            ) : null}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setEmbedModalOpen(false)}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50"
                    >
                      返回编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const picked = eligibleEmbedFragments.filter((f) => embedSelectedIds.has(f.id));
                        if (picked.length === 0) return;
                        richEditorRef.current?.insertResourceEmbeds(picked);
                        setEmbedModalOpen(false);
                      }}
                      disabled={embedSelectedIds.size === 0}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none disabled:hover:bg-slate-200 disabled:cursor-not-allowed"
                    >
                      插入到光标处
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {moduleName}名称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder={`请输入${moduleName}名称`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{moduleName}描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder={`简要描述${moduleName}用途`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    {moduleName}内容 <span className="text-rose-500">*</span>
                  </label>
                  {isTextModulePage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!scopeInsertReady) return;
                        setEmbedSearch('');
                        setEmbedSelectedIds(new Set());
                        setEmbedModuleFilter('all');
                        setEmbedModalOpen(true);
                      }}
                      disabled={!scopeInsertReady}
                      title={
                        scopeInsertReady
                          ? '插入其它资源的名称占位（不含文本库），范本中按标段展开正文'
                          : '请先选择适用标段范围：勾选「通用」或指定叶子标段后，方可插入其它资源占位'
                      }
                      className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                      资源插入
                    </button>
                  )}
                </div>
                <RichTextEditor
                  ref={richEditorRef}
                  content={formData.content}
                  onChange={html => setFormData(prev => ({ ...prev, content: html }))}
                  placeholder={`输入${moduleName}内容，支持标题、列表、表格等格式...`}
                />
                {isTextModulePage && (
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    「资源插入」仅可嵌入<strong className="font-medium text-slate-600">资格 / 评标 / 合同</strong>
                    资源，在正文插入蓝色名称占位；范本展示时按标段解析正文。
                  </p>
                )}
              </div>

              <LotScopePicker
                key={categoryPickerEpoch}
                store={classificationStore}
                universal={applicableToAllLotLevels}
                selectedLotLevelIds={applicableLotLevelIds}
                onUniversalChange={(v) => {
                  setApplicableToAllLotLevels(v);
                  if (v) setScopeError(null);
                }}
                onToggleLot={(lotLevelId, checked) => {
                  setApplicableLotLevelIds((prev) => {
                    if (checked) return prev.includes(lotLevelId) ? prev : [...prev, lotLevelId];
                    return prev.filter((x) => x !== lotLevelId);
                  });
                  setScopeError(null);
                }}
              />
              {scopeError && (
                <p className="text-xs text-rose-600">{scopeError}</p>
              )}
              </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.content.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      <SystemDialog
        open={deleteTextId !== null}
        title="确认删除"
        message="确定要删除该资源吗？"
        tone="danger"
        variant="confirm"
        confirmText="删除"
        onConfirm={confirmDeleteText}
        onClose={() => setDeleteTextId(null)}
      />

      <OperationLogDialog
        open={textLogId !== null}
        onClose={() => setTextLogId(null)}
        title={textLogTitle}
        entries={textLogEntries}
      />

    </div>
  );
}
