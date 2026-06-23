'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Edit2, FileCheck, FilePlus2, FileText, Loader2, Plus, Save, Scale, Search, Shield, Trash2 } from 'lucide-react';
import type { Template, TemplateSection, TemplateVariable, TextBinding, TextFragment } from '@/types';
import { getGlobalTemplateVariables, getMockTextFragments } from '@/lib/mockData';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { textFragmentAppliesToTemplate } from '@/lib/textFragmentLotScope';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import { expandNestedResourceEmbeds } from '@/lib/resourceEmbedHtml';
import { buildResourceInsertHtml } from '@/lib/quotedBlockHtml';
import { getSectionTitlesForFragmentInTemplate } from '@/lib/textFragmentReference';
import { normalizePasteHtmlForWps } from '@/lib/wpsPasteHtmlNormalize';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { TemplateEditorTitleBlock } from '@/components/editor/TemplateEditorTitleBlock';

// ─────────────────────────────────────────────────────────────────────────────
// OnlyOffice API 脚本全局单例加载（防止 React Strict Mode 二次注入）
// ─────────────────────────────────────────────────────────────────────────────
let apiScriptStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const apiScriptCallbacks: Array<() => void> = [];
const apiScriptErrbacks: Array<(e: Error) => void> = [];

function loadOnlyOfficeApi(src: string): Promise<void> {
  if (apiScriptStatus === 'ready' && window.DocsAPI) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (apiScriptStatus === 'ready') { resolve(); return; }
    if (apiScriptStatus === 'error') { reject(new Error('Failed to load OnlyOffice API')); return; }
    apiScriptCallbacks.push(resolve);
    apiScriptErrbacks.push(reject);
    if (apiScriptStatus === 'loading') return;
    apiScriptStatus = 'loading';
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      apiScriptStatus = 'ready';
      apiScriptCallbacks.splice(0).forEach(cb => cb());
    };
    script.onerror = () => {
      apiScriptStatus = 'error';
      const err = new Error('Failed to load OnlyOffice API');
      apiScriptErrbacks.splice(0).forEach(cb => cb(err));
    };
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────
function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (origin.includes('localhost:3000')) return 'http://host.docker.internal:3000';
  return origin;
}

function stripHtmlPreview(html: string) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function toInsertPlainText(raw: string) {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toJsStringLiteral(raw: string) {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

/** 变量库插入正文：行内 span，不包段落，避免破坏当前行/表格单元格格式 */
function buildVariableInsertHtml(v: TemplateVariable): string {
  const key = v.key.trim();
  const displayName = (v.name?.trim() || key).trim();
  const k = escapeHtml(key);
  const d = escapeHtml(displayName);
  return (
    `<span data-oo-insert="variable" data-template-variable="${k}" title="${k}" ` +
    `style="display:inline;padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:6px;font-size:inherit;line-height:inherit;font-weight:500;border:1px solid #93c5fd;white-space:nowrap;vertical-align:baseline;">${d}</span>`
  );
}

/** 侧栏插入资源：见 buildResourceInsertHtml */
// ─────────────────────────────────────────────────────────────────────────────
// 资源列表构建辅助
// ─────────────────────────────────────────────────────────────────────────────
type ResourceModule = NonNullable<TextFragment['module']>;

function resolveFragmentModule(frag: TextFragment): ResourceModule {
  return frag.module ?? 'text';
}

type ResourceTextCard = {
  id: string;
  title: string;
  summary: string;
  sectionsLabel: string;
  copyPayload: string;
  source: 'linked' | 'pool';
  module: ResourceModule;
};

function bindingAppliesToTemplate(b: TextBinding, tpl: Template): boolean {
  if (b.templateId && b.templateId === tpl.id) return true;
  if (b.frameworkId && b.chapterId && tpl.frameworkId === b.frameworkId) {
    const walk = (secs: TemplateSection[]): boolean => {
      for (const s of secs) {
        if (s.chapterId === b.chapterId) return true;
        if (s.children?.length && walk(s.children)) return true;
      }
      return false;
    };
    return walk(tpl.sections);
  }
  return false;
}

function collectTemplateLinkedTextCards(template: Template, fragments: TextFragment[]) {
  return fragments
    .filter((frag) => textFragmentAppliesToTemplate(frag, template))
    .map((frag) => {
      const fromBindings = (frag.bindings ?? []).filter((b) => bindingAppliesToTemplate(b, template));
      const fromSections = getSectionTitlesForFragmentInTemplate(template.sections, frag.id);
      if (fromBindings.length === 0 && fromSections.length === 0) return null;
      const sectionLabels = [
        ...fromBindings.map((b) => b.sectionTitle || b.chapterTitle || '').filter(Boolean),
        ...fromSections,
      ];
      const uniqueLabels = [...new Set(sectionLabels)];
      const rawHtml = frag.content ?? '';
      const summary = frag.description?.trim() || stripHtmlPreview(rawHtml).slice(0, 220);
      return {
        id: frag.id,
        title: frag.name,
        summary: summary || '（无摘要）',
        sectionsLabel: uniqueLabels.length ? uniqueLabels.join('、') : '（未定位章节标题）',
        copyPayload: rawHtml || frag.name,
        source: 'linked' as const,
        module: resolveFragmentModule(frag),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function collectTemplateFallbackTextCards(template: Template, fragments: TextFragment[]): ResourceTextCard[] {
  return fragments
    .filter((frag) => textFragmentAppliesToTemplate(frag, template))
    .map((frag) => {
      const linkedByBinding = (frag.bindings ?? []).some((b) => bindingAppliesToTemplate(b, template));
      const linkedBySection = getSectionTitlesForFragmentInTemplate(template.sections, frag.id).length > 0;
      if (linkedByBinding || linkedBySection) return null;
      const rawHtml = frag.content ?? '';
      const summary = frag.description?.trim() || stripHtmlPreview(rawHtml).slice(0, 220);
      return {
        id: frag.id,
        title: frag.name,
        summary: summary || '（无摘要）',
        sectionsLabel: '未绑定当前范本',
        copyPayload: rawHtml || frag.name,
        source: 'pool' as const,
        module: resolveFragmentModule(frag),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function systemTabToResourceModule(
  tab: 'text' | 'qualification' | 'evaluation' | 'contract' | 'variables' | 'ai',
): ResourceModule | null {
  if (tab === 'variables' || tab === 'ai') return null;
  if (tab === 'contract') return 'contract-clause';
  return tab;
}

// ─────────────────────────────────────────────────────────────────────────────
// OnlyOffice 文本插入工具
// ─────────────────────────────────────────────────────────────────────────────
type OoEditorInstance = {
  destroyEditor?: () => void;
  downloadAs?: (format: string) => void;
  executeMethod?: (methodName: string, params?: unknown[], callback?: () => void) => void;
  executeCommand?: (commandName: string, payload?: unknown) => void;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// 组件接口
// ─────────────────────────────────────────────────────────────────────────────
interface OnlyOfficeTemplateEditorProps {
  template: Template;
  onBack: () => void;
  onSave: (template: Template) => void;
}

export function OnlyOfficeTemplateEditor({ template, onBack, onSave }: OnlyOfficeTemplateEditorProps) {
  // ── 基础状态 ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorInstanceRef = useRef<OoEditorInstance | null>(null);
  const generationRef = useRef(0);

  // ── 侧栏状态 ──
  const [activeSystemTab, setActiveSystemTab] = useState<'text' | 'qualification' | 'evaluation' | 'contract' | 'variables' | 'ai'>('text');
  const [insertHint, setInsertHint] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resourceFilterQuery, setResourceFilterQuery] = useState('');
  const [resourceDataTick, setResourceDataTick] = useState(0);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  // ── 变量状态 ──
  const [editorVariables, setEditorVariables] = useState(() =>
    (template.variables ?? []).filter((v) => v.scope !== 'global'),
  );
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [variableModalMode, setVariableModalMode] = useState<'create' | 'edit'>('create');
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null);
  const [newVariableIdentifier, setNewVariableIdentifier] = useState('');
  const [newVariableName, setNewVariableName] = useState('');
  const [newVariableSampleValue, setNewVariableSampleValue] = useState('');
  const [deleteVariableId, setDeleteVariableId] = useState<string | null>(null);

  // ── 插入失败重试弹窗 ──
  const [resourceInsertRetryItem, setResourceInsertRetryItem] = useState<ResourceTextCard | null>(null);
  const [variableInsertRetryItem, setVariableInsertRetryItem] = useState<TemplateVariable | null>(null);

  const templateRef = useRef(template);
  templateRef.current = template;

  // ── 全局变量目录 ──
  const globalVariableCatalog = useMemo(() => {
    void resourceDataTick;
    return getGlobalTemplateVariables();
  }, [resourceDataTick]);

  // ── 资源数据刷新 ──
  useEffect(() => {
    const refresh = () => setResourceDataTick((t) => t + 1);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => { setResourceFilterQuery(''); }, [activeSystemTab]);

  useEffect(() => {
    const raw = template.variables ?? [];
    setEditorVariables(raw.filter((v) => v.scope !== 'global'));
  }, [template.id, template.variables]);

  // ── 资源数据 ──
  const allFragments = useMemo(
    () => sortByCreatedAtDesc(getMockTextFragments()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template.id, template.updatedAt, resourceDataTick, template.sections],
  );

  const linkedTextCards = useMemo(
    () => collectTemplateLinkedTextCards(template, allFragments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template.id, template.updatedAt, resourceDataTick, template.sections, allFragments],
  );

  const fallbackTextCards = useMemo(
    () => collectTemplateFallbackTextCards(template, allFragments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template.id, template.updatedAt, resourceDataTick, template.sections, allFragments],
  );

  const tabResourceItems = useMemo(() => {
    const m = systemTabToResourceModule(activeSystemTab);
    if (!m) return [];
    return linkedTextCards.filter((it) => it.module === m);
  }, [linkedTextCards, activeSystemTab]);

  const fallbackTabResourceItems = useMemo(() => {
    const m = systemTabToResourceModule(activeSystemTab);
    if (!m) return [];
    return fallbackTextCards.filter((it) => it.module === m);
  }, [fallbackTextCards, activeSystemTab]);

  const displayedResourceItems = useMemo(() => {
    const linkedIds = new Set(tabResourceItems.map((item) => item.id));
    const pool = fallbackTabResourceItems.filter((item) => !linkedIds.has(item.id));
    return [...tabResourceItems, ...pool];
  }, [tabResourceItems, fallbackTabResourceItems]);

  const filteredResourceItems = useMemo(() => {
    const q = resourceFilterQuery.trim().toLowerCase();
    if (!q) return displayedResourceItems;
    return displayedResourceItems.filter((item) =>
      item.title.toLowerCase().includes(q)
      || item.summary.toLowerCase().includes(q)
      || item.sectionsLabel.toLowerCase().includes(q),
    );
  }, [displayedResourceItems, resourceFilterQuery]);

  const activeResourceTabLabel = useMemo(() => {
    if (activeSystemTab === 'qualification') return '资格条件';
    if (activeSystemTab === 'evaluation') return '评标办法';
    if (activeSystemTab === 'contract') return '合同条款';
    return '文本';
  }, [activeSystemTab]);

  const quickPickVariables = useMemo(() => {
    const custom = editorVariables;
    const rest = globalVariableCatalog.filter((g) => !custom.some((c) => c.key === g.key));
    return [...custom, ...rest].slice(0, 8);
  }, [editorVariables, globalVariableCatalog]);

  // ─────────────────────────────────────────────────────────────────────────
  // OnlyOffice 文本插入（通过 executeMethod / executeCommand）
  // ─────────────────────────────────────────────────────────────────────────
  const focusEditorFrame = useCallback(() => {
    try {
      const frame = editorHostRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
      frame?.focus();
      frame?.contentWindow?.focus();
    } catch { /* ignore cross-origin */ }
  }, []);

  const callExecuteMethod = useCallback(
    (ed: OoEditorInstance, methodName: string, params: unknown[] = [], timeoutMs = 900) =>
      new Promise<boolean>((resolve) => {
        if (typeof ed.executeMethod !== 'function') { resolve(false); return; }
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(ok);
        };
        const timer = window.setTimeout(() => finish(false), timeoutMs);
        try {
          ed.executeMethod(methodName, params, () => finish(true));
        } catch { finish(false); }
      }),
    [],
  );

  const tryInsertIntoOoEditor = useCallback(async (text: string, html?: string): Promise<boolean> => {
    const ed = editorInstanceRef.current;
    if (!ed) return false;
    try {
      if (html) {
        if (await callExecuteMethod(ed, 'PasteHtml', [html])) return true;
        if (await callExecuteMethod(ed, 'pasteHtml', [html])) return true;
      }
      if (await callExecuteMethod(ed, 'PasteText', [text])) return true;
      if (await callExecuteMethod(ed, 'pasteText', [text])) return true;
      if (await callExecuteMethod(ed, 'InsertText', [text])) return true;
      if (typeof ed.executeCommand === 'function') {
        const script = [
          'var doc = Api.GetDocument();',
          'var p = Api.CreateParagraph();',
          `p.AddText('${toJsStringLiteral(text)}');`,
          'doc.InsertContent([p]);',
        ].join('');
        try { ed.executeCommand('command', script); return true; } catch { /* ignore */ }
      }
    } catch { return false; }
    return false;
  }, [callExecuteMethod]);

  const tryInsertWithRetries = useCallback(async (text: string, html?: string): Promise<boolean> => {
    const attempts = [0, 120, 260, 420, 700, 1200, 2000];
    for (const waitMs of attempts) {
      if (waitMs > 0) await sleep(waitMs);
      focusEditorFrame();
      if (await tryInsertIntoOoEditor(text, html)) return true;
    }
    return false;
  }, [focusEditorFrame, tryInsertIntoOoEditor]);

  const insertTextAtCursor = useCallback(async (
    text: string,
    labelForHint?: string,
    htmlForInsert?: string,
    options?: { suppressSidebarHints?: boolean },
  ) => {
    const silent = options?.suppressSidebarHints === true;
    const plainText = toInsertPlainText(text);
    const htmlTrim = htmlForInsert?.trim();
    const shown = (labelForHint ?? plainText) || '内容';
    if (!plainText && !htmlTrim) {
      if (!silent) setInsertHint('无可插入内容');
      return false;
    }
    if (!silent) setInsertHint(null);
    if (await tryInsertWithRetries(plainText || '\u200b', htmlForInsert)) {
      if (!silent) setInsertHint(`已插入：${shown}`);
      return true;
    }
    if (!silent) setInsertHint(`插入失败：${shown}，请先在编辑器内点击定位光标`);
    return false;
  }, [tryInsertWithRetries]);

  // ─────────────────────────────────────────────────────────────────────────
  // 资源插入
  // ─────────────────────────────────────────────────────────────────────────
  const insertResourceCardAtCursor = useCallback(async (item: ResourceTextCard) => {
    const resolved = expandNestedResourceEmbeds(item.copyPayload, resolveTemplateLotLevelId(template), allFragments);
    const forWps = normalizePasteHtmlForWps(resolved);
    const { plainBlock, htmlBlock } = buildResourceInsertHtml(forWps, item.id);
    const inserted = await insertTextAtCursor(plainBlock, item.title, htmlBlock, { suppressSidebarHints: true });
    return { inserted: Boolean(inserted), plainBlock, htmlBlock };
  }, [insertTextAtCursor, template.lotLevelId, allFragments]);

  const handleInsertResource = useCallback(async (item: ResourceTextCard) => {
    const result = await insertResourceCardAtCursor(item);
    if (!result.inserted) { setResourceInsertRetryItem(item); return; }
    setInsertHint('已插入到当前光标位置');
  }, [insertResourceCardAtCursor]);

  // ─────────────────────────────────────────────────────────────────────────
  // 变量操作
  // ─────────────────────────────────────────────────────────────────────────
  const insertVariableAtCursor = useCallback(async (variable: TemplateVariable) => {
    const key = variable.key.trim();
    if (!key) { setInsertHint('变量标识为空'); return; }
    const html = buildVariableInsertHtml(variable);
    const hintLabel = variable.name.trim() || key;
    const ok = await insertTextAtCursor(key, hintLabel, html, { suppressSidebarHints: true });
    if (ok) setInsertHint(`已插入：${hintLabel}`);
    else setVariableInsertRetryItem(variable);
  }, [insertTextAtCursor]);

  const normalizeVariableKey = useCallback((identifier: string) => {
    const raw = identifier.trim();
    if (!raw) return '';
    if (raw.startsWith('{{') && raw.endsWith('}}')) return raw;
    return `{{${raw}}}`;
  }, []);

  const resetVariableModal = useCallback(() => {
    setVariableModalOpen(false);
    setVariableModalMode('create');
    setEditingVariableId(null);
    setNewVariableIdentifier('');
    setNewVariableName('');
    setNewVariableSampleValue('');
  }, []);

  const openCreateVariableModal = useCallback(() => {
    setVariableModalMode('create');
    setEditingVariableId(null);
    setNewVariableIdentifier('');
    setNewVariableName('');
    setNewVariableSampleValue('');
    setVariableModalOpen(true);
  }, []);

  const openEditVariableModal = useCallback((variableId: string) => {
    const target = editorVariables.find((v) => v.id === variableId);
    if (!target) return;
    setVariableModalMode('edit');
    setEditingVariableId(variableId);
    setNewVariableIdentifier(target.key);
    setNewVariableName(target.name);
    setNewVariableSampleValue(target.defaultValue ?? '');
    setVariableModalOpen(true);
  }, [editorVariables]);

  const handleSaveVariable = useCallback(() => {
    const identifier = newVariableIdentifier.trim();
    const name = newVariableName.trim();
    const sampleValue = newVariableSampleValue.trim();
    if (!identifier || !name) { setInsertHint('请填写变量标识和变量名称'); return; }
    const key = normalizeVariableKey(identifier);
    const existsInCustom = editorVariables.some((v) =>
      (v.key === key || v.name === name)
      && (variableModalMode === 'create' || v.id !== editingVariableId),
    );
    if (existsInCustom) { setInsertHint(`变量已存在：${key}`); return; }
    if (variableModalMode === 'create' && globalVariableCatalog.some((g) => g.key === key)) {
      setInsertHint(`「${key}」已在通用型变量中，请换标识或直接使用通用变量插入`);
      return;
    }
    const next = variableModalMode === 'edit' && editingVariableId
      ? editorVariables.map((v) =>
        v.id === editingVariableId
          ? { ...v, name, key, defaultValue: sampleValue, scope: 'template' as const }
          : v,
      )
      : [
        ...editorVariables,
        { id: `var-${Date.now()}`, name, key, defaultValue: sampleValue, scope: 'template' as const },
      ];
    setEditorVariables(next);
    resetVariableModal();
    setInsertHint(variableModalMode === 'edit' ? `已更新变量 ${key}` : `已新增变量 ${key}`);
  }, [
    editorVariables, editingVariableId, globalVariableCatalog,
    newVariableIdentifier, newVariableName, newVariableSampleValue,
    normalizeVariableKey, resetVariableModal, variableModalMode,
  ]);

  const handleDeleteVariable = useCallback((variableId: string) => { setDeleteVariableId(variableId); }, []);

  const confirmDeleteVariable = useCallback(() => {
    if (!deleteVariableId) return;
    const target = editorVariables.find((v) => v.id === deleteVariableId);
    if (!target) { setDeleteVariableId(null); return; }
    setEditorVariables((prev) => prev.filter((v) => v.id !== deleteVariableId));
    setInsertHint(`已删除变量 ${target.key}`);
    if (editingVariableId === deleteVariableId) resetVariableModal();
    setDeleteVariableId(null);
  }, [deleteVariableId, editorVariables, editingVariableId, resetVariableModal]);

  const handleCopyText = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1200);
    } catch { setCopiedKey(null); }
  }, []);

  // AI 演示数据
  const aiDemoSuggestions = useMemo(() => [
    {
      id: 'ai-1',
      title: '扩写"资格条件"段落',
      prompt: '请将资格条件条款扩写为更正式的招标语言，包含合规性、财务能力、履约能力三部分。',
      output: `【演示扩写结果】\n投标人除具备独立法人资格外，还应具有良好的财务状况与履约能力。投标人须提供近三年经审计的财务报告，确保具备承担本项目的资金实力；同时应提供类似项目业绩证明和履约承诺，以保障项目按期高质量实施。`,
    },
    {
      id: 'ai-2',
      title: '扩写"违约责任"段落',
      prompt: '请将违约责任条款扩写为可直接纳入合同附件的版本。',
      output: `【演示扩写结果】\n如乙方未按合同约定期限完成交付，每延期一日，应按合同总价的万分之五向甲方支付违约金。延期超过十五日的，甲方有权单方解除合同并追究由此造成的全部损失。`,
    },
  ], []);

  const systemTabs = useMemo(() => [
    { key: 'text' as const, label: '文本管理', icon: FileText },
    { key: 'qualification' as const, label: '资格条件', icon: Shield },
    { key: 'evaluation' as const, label: '评标办法', icon: Scale },
    { key: 'contract' as const, label: '合同条款', icon: FileCheck },
    { key: 'variables' as const, label: '变量库', icon: FilePlus2 },
    { key: 'ai' as const, label: 'AI扩写', icon: Bot },
  ], []);

  // ─────────────────────────────────────────────────────────────────────────
  // OnlyOffice 编辑器初始化
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const gen = ++generationRef.current;
    const hostId = `oo-host-${template.id}-${gen}`;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const loadEditor = async () => {
      try {
        setLoading(true);
        setError(null);

        // 注销旧的 OnlyOffice service worker
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              const scope = reg.scope || '';
              if (scope.includes('localhost:8088') || scope.includes('onlyoffice')) await reg.unregister();
            }
          } catch { /* ignore */ }
        }

        await loadOnlyOfficeApi('http://localhost:8088/web-apps/apps/api/documents/api.js');

        if (generationRef.current !== gen || !containerRef.current) return;

        const host = document.createElement('div');
        host.id = hostId;
        host.style.width = '100%';
        host.style.height = '100%';
        containerRef.current.appendChild(host);
        editorHostRef.current = host;

        const publicBase = getPublicBaseUrl();
        const fileUrl = `${publicBase}/api/documents/${encodeURIComponent(template.id)}`;
        const callbackUrl = `${publicBase}/api/onlyoffice/callback`;

        const config = {
          document: {
            fileType: 'docx',
            key: `${template.id}-${gen}`,
            title: `${template.name}.docx`,
            url: fileUrl,
          },
          editorConfig: {
            mode: 'edit',
            lang: 'zh-CN',
            callbackUrl,
            user: { id: 'fanben_editor_user', name: '编制用户' },
            customization: { compactHeader: true, forceSave: true, spellcheck: false },
          },
          events: {
            onAppReady: () => {
              if (generationRef.current === gen) setLoading(false);
            },
            onDocumentReady: () => {
              if (generationRef.current === gen) setLoading(false);
            },
            onError: (event: unknown) => {
              let msg = '未知错误';
              if (typeof event === 'string') msg = event;
              else if (event && typeof (event as Record<string, unknown>).data === 'string')
                msg = (event as Record<string, unknown>).data as string;
              else if (event && typeof (event as Error).message === 'string')
                msg = (event as Error).message;
              else { try { msg = JSON.stringify(event); } catch { /* ignore */ } }
              if (generationRef.current === gen) {
                setError(`OnlyOffice 错误: ${msg}`);
                setLoading(false);
              }
            },
          },
        };

        if (window.DocsAPI && editorHostRef.current) {
          editorInstanceRef.current = new window.DocsAPI.DocEditor(hostId, config) as OoEditorInstance;
        }

        // 兜底：8 秒后如果 iframe 已挂载则强制隐藏加载动画
        fallbackTimer = setTimeout(() => {
          if (generationRef.current !== gen) return;
          const hostEl = document.getElementById(hostId);
          if (hostEl && hostEl.querySelector('iframe')) setLoading(false);
        }, 8000);
      } catch (err) {
        if (generationRef.current === gen) {
          setError(err instanceof Error ? err.message : 'OnlyOffice 初始化失败');
          setLoading(false);
        }
      }
    };

    loadEditor();

    return () => {
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      generationRef.current = gen + 1;
      try { editorInstanceRef.current?.destroyEditor?.(); } catch { /* ignore */ }
      editorInstanceRef.current = null;
      const host = editorHostRef.current;
      if (host && host.parentNode) host.parentNode.removeChild(host);
      editorHostRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const handleSave = () => {
    onSave({ ...template, variables: editorVariables });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="shrink-0 min-h-14 py-2 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button type="button" onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <TemplateEditorTitleBlock template={template} editorLabel="OnlyOffice 在线编辑" />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          保存并返回
        </button>
      </div>

      {/* Body: Editor + Sidebar */}
      <div className="flex-1 flex bg-slate-100 min-h-0">
        {/* Editor area */}
        <div className="flex-1 relative min-w-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在加载 OnlyOffice…
              </div>
            </div>
          )}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-lg shadow-sm">
              <p className="font-medium">{error}</p>
              <p className="text-xs text-rose-600/90 mt-2">
                请确认 OnlyOffice Document Server 已在本地启动（docker run -p 8088:80 onlyoffice/documentserver）
              </p>
            </div>
          )}
          {/* React 管理的占位容器；实际 OnlyOffice 宿主由 useEffect 动态追加 */}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* 右侧系统功能区 */}
        <aside className="w-[360px] bg-white border-l border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">系统功能区</h3>
            <p className="text-xs text-slate-500 mt-0.5">与「资源管理」同一套文本数据</p>
            {linkedTextCards.length > 0 && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-2 text-[11px] text-blue-900 leading-relaxed">
                <span className="font-medium text-blue-950">引用资源：</span>
                正文以资源管理中的当前稿为准；本页保存时会用资源稿覆盖引用章节，更新正文请至资源管理。
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex">
            {/* Tab 导航 */}
            <div className="w-28 shrink-0 border-r border-slate-200 p-2 space-y-1">
              {systemTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSystemTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSystemTab(tab.key)}
                    className={`w-full flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-xs rounded-lg transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* 资源类 Tab */}
              {(activeSystemTab === 'text'
                || activeSystemTab === 'qualification'
                || activeSystemTab === 'evaluation'
                || activeSystemTab === 'contract') && (
                <>
                  <div className="border border-slate-200 rounded-lg px-2.5 py-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={resourceFilterQuery}
                        onChange={(e) => setResourceFilterQuery(e.target.value)}
                        placeholder="按名称查询…"
                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {filteredResourceItems.length === 0 ? (
                    <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                      {resourceFilterQuery.trim() ? (
                        <p>没有符合筛选条件的条目，请调整关键词。</p>
                      ) : linkedTextCards.length === 0 && fallbackTextCards.length === 0 ? (
                        <p>
                          资源管理里暂无可展示数据。请先在左侧{' '}
                          <span className="font-medium text-slate-700">资源管理 → 文本管理</span>{' '}
                          新建并保存文本。
                        </p>
                      ) : (
                        <p>
                          本分类下暂无匹配的{activeResourceTabLabel}资源。请切换至其他 Tab，或在资源管理中调整名称/描述。
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredResourceItems.map((item) => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-800">{item.title}</span>
                          </div>
                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleInsertResource(item)}
                              aria-label="插入到当前光标位置"
                              className="p-1 rounded hover:bg-slate-100 text-slate-500"
                              title="以高亮块插入到当前光标位置"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {item.source === 'linked' ? `绑定至：${item.sectionsLabel}` : item.sectionsLabel}
                        </div>
                        <div className="mt-1 text-xs text-slate-600 line-clamp-4">{item.summary}</div>
                      </div>
                    ))
                  )}
                  {insertHint && (
                    <div className="text-[11px] text-slate-500 leading-relaxed">{insertHint}</div>
                  )}
                </>
              )}

              {/* 变量库 Tab */}
              {activeSystemTab === 'variables' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] border-b border-slate-100 bg-slate-50/90">
                      <span className="text-sm font-semibold text-slate-800 truncate">变量库管理</span>
                      <button
                        type="button"
                        onClick={openCreateVariableModal}
                        title="新增仅本范本使用的变量"
                        className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        新增自定义
                      </button>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-slate-500 leading-snug">
                      通用型同步「范本变量管理」；右侧新增仅为本范本变量。
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-600 mb-1.5">通用型</div>
                    <div className="space-y-2">
                      {globalVariableCatalog.map((variable) => (
                        <div key={variable.id} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/80">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-800 truncate">{variable.name}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{variable.key}</div>
                              {variable.defaultValue && (
                                <div className="text-[11px] text-slate-400 mt-0.5">示例值：{variable.defaultValue}</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => void insertVariableAtCursor(variable)}
                              aria-label="插入变量"
                              className="shrink-0 p-1 rounded hover:bg-white text-slate-500"
                              title="插入到光标位置"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-600 mb-1.5">自定义（仅本范本）</div>
                    <div className="space-y-2">
                      {editorVariables.length === 0 ? (
                        <div className="text-xs text-slate-400">暂无自定义变量</div>
                      ) : (
                        editorVariables.map((variable) => (
                          <div key={variable.id} className="border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm text-slate-800 truncate">{variable.name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{variable.key}</div>
                                {variable.defaultValue && (
                                  <div className="text-[11px] text-slate-400 mt-0.5">示例值：{variable.defaultValue}</div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => openEditVariableModal(variable.id)}
                                  aria-label="编辑变量"
                                  className="p-1 rounded hover:bg-slate-100 text-slate-500"
                                  title="编辑变量"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariable(variable.id)}
                                  aria-label="删除变量"
                                  className="p-1 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                  title="删除变量"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void insertVariableAtCursor(variable)}
                                  aria-label="插入变量到当前光标位置"
                                  className="p-1 rounded hover:bg-slate-100 text-slate-500"
                                  title="插入变量到当前光标位置"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {insertHint && (
                    <div className="text-[11px] text-slate-500 leading-relaxed">{insertHint}</div>
                  )}

                  {variableModalOpen && (
                    <ModalOverlay zClassName="z-[60]">
                      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <div className="text-sm font-semibold text-slate-900">
                          {variableModalMode === 'edit' ? '编辑变量' : '新增变量'}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="mb-1 block text-xs text-slate-600">变量标识</label>
                            <input
                              type="text"
                              value={newVariableIdentifier}
                              onChange={(e) => setNewVariableIdentifier(e.target.value)}
                              placeholder="例如：招标编号 或 {{招标编号}}"
                              className="w-full rounded border border-slate-200 px-2.5 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-600">变量名称</label>
                            <input
                              type="text"
                              value={newVariableName}
                              onChange={(e) => setNewVariableName(e.target.value)}
                              placeholder="例如：招标编号"
                              className="w-full rounded border border-slate-200 px-2.5 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-600">示例值</label>
                            <input
                              type="text"
                              value={newVariableSampleValue}
                              onChange={(e) => setNewVariableSampleValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveVariable()}
                              placeholder="例如：ZB-2026-001"
                              className="w-full rounded border border-slate-200 px-2.5 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={resetVariableModal}
                            className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveVariable}
                            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    </ModalOverlay>
                  )}
                </div>
              )}

              {/* AI 扩写 Tab */}
              {activeSystemTab === 'ai' && (
                <div className="space-y-3">
                  {aiDemoSuggestions.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-2.5">
                      <div className="text-sm font-medium text-slate-800">{item.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500">提示词：{item.prompt}</div>
                      <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-700 whitespace-pre-wrap">
                        {item.output}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleCopyText(item.id, item.output)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                        >
                          {copiedKey === item.id ? '已复制' : '复制结果'}
                        </button>
                        <button
                          onClick={() => setSystemNotice('演示：可在此调用后端 AI 接口执行扩写')}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          执行扩写
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-[11px] text-slate-400">
                    当前文档：{template.name}（{template.id}）
                  </div>
                </div>
              )}

              {/* 文本管理 Tab 底部变量快捷栏 */}
              {activeSystemTab === 'text' && quickPickVariables.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] text-slate-400 mb-1">可用变量（通用 + 本范本自定义）</div>
                  <div className="flex flex-wrap gap-1">
                    {quickPickVariables.slice(0, 4).map((variable) => (
                      <button
                        key={`var-demo-${variable.id}`}
                        onClick={() => void insertVariableAtCursor(variable)}
                        className="px-2 py-0.5 text-[11px] rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        {variable.name}
                      </button>
                    ))}
                  </div>
                  {insertHint && (
                    <div className="mt-1 text-[11px] text-slate-500 leading-relaxed">{insertHint}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 弹窗 */}
      <SystemDialog
        open={deleteVariableId !== null}
        title="确认删除"
        message={`确认删除变量 ${editorVariables.find((v) => v.id === deleteVariableId)?.key ?? ''} 吗？`}
        tone="danger"
        variant="confirm"
        onClose={() => setDeleteVariableId(null)}
        onConfirm={confirmDeleteVariable}
      />

      <SystemDialog
        open={resourceInsertRetryItem !== null}
        title="资源插入失败"
        message="未能将资源写入编辑器当前光标位置，是否重新尝试插入？"
        tone="warning"
        variant="confirm"
        confirmText="重试"
        cancelText="取消"
        onClose={() => setResourceInsertRetryItem(null)}
        onConfirm={() => {
          const item = resourceInsertRetryItem;
          setResourceInsertRetryItem(null);
          if (item) void handleInsertResource(item);
        }}
      />

      <SystemDialog
        open={variableInsertRetryItem !== null}
        title="变量插入失败"
        message="未能将变量写入编辑器当前光标位置，是否重新尝试插入？"
        tone="warning"
        variant="confirm"
        confirmText="重试"
        cancelText="取消"
        onClose={() => setVariableInsertRetryItem(null)}
        onConfirm={() => {
          const v = variableInsertRetryItem;
          setVariableInsertRetryItem(null);
          if (v) void insertVariableAtCursor(v);
        }}
      />

      <SystemDialog
        open={systemNotice !== null}
        title="系统提示"
        message={systemNotice ?? ''}
        onClose={() => setSystemNotice(null)}
        onConfirm={() => setSystemNotice(null)}
      />
    </div>
  );
}
