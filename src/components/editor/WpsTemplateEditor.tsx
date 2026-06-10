'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Edit2, FileCheck, FilePlus2, FileText, Loader2, Plus, Save, Scale, Search, Shield, Trash2 } from 'lucide-react';
import { asBlob } from 'html-docx-js-typescript';
import type { Template, TemplateSection, TemplateVariable, TextBinding, TextFragment } from '@/types';
import { getGlobalTemplateVariables, getMockTextFragments } from '@/lib/mockData';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { textFragmentAppliesToTemplateLot } from '@/lib/textFragmentLotScope';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import { applyCanonicalResourceBodiesToSections, buildSectionsHtmlWithResources } from '@/lib/resolveTemplateSectionHtml';
import { expandNestedResourceEmbeds } from '@/lib/resourceEmbedHtml';
import { normalizePasteHtmlForWps } from '@/lib/wpsPasteHtmlNormalize';
import { parseSectionsFromHTML } from '@/lib/parseSectionsFromHTML';
import { mergeParsedSectionsWithPrevious } from '@/lib/mergeParsedTemplateSections';
import type { WebOfficeSdkInstance } from '@/lib/webOfficeSdk';
import { loadWebOfficeSdk } from '@/lib/webOfficeSdk';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { TemplateEditorTitleBlock } from '@/components/editor/TemplateEditorTitleBlock';
import { useGlobalLoading } from '@/components/ui/GlobalLoading';

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

/** 变量库插入正文：独立段落 + 高亮展示变量名称（data-template-variable 保留 key 供检索） */
function buildVariableInsertHtml(v: TemplateVariable): string {
  const key = v.key.trim();
  const displayName = (v.name?.trim() || key).trim();
  const k = escapeHtml(key);
  const d = escapeHtml(displayName);
  return (
    `<p style="margin:0.35em 0;line-height:1.75;text-indent:0;" data-oo-insert="variable">` +
    `<span data-template-variable="${k}" title="${k}" ` +
    `style="display:inline-block;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:6px;font-size:14px;font-weight:500;border:1px solid #93c5fd;white-space:nowrap;">${d}</span>` +
    `</p>`
  );
}

/** 侧栏插入资源：只插入正文，不带 Tab/卡片标题装饰；若正文为 HTML 则保留格式 */
function formatResourceInsertPayload(content: string) {
  const trimmed = (content ?? '').trim();
  if (!trimmed) {
    return { plainBlock: '', htmlBlock: '' as string | undefined };
  }
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  const plainBlock = toInsertPlainText(content);
  let htmlBlock: string | undefined;
  if (looksLikeHtml) {
    htmlBlock = `<div data-resource-insert="1">${trimmed}</div>`;
  } else if (plainBlock) {
    htmlBlock = `<div data-resource-insert="1" style="white-space:pre-wrap;color:#334155;line-height:1.7;">${escapeHtml(plainBlock).replace(/\n/g, '<br/>')}</div>`;
  }
  return { plainBlock, htmlBlock };
}

function toJsStringLiteral(raw: string) {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function awaitMaybe<T>(v: T | PromiseLike<T>): Promise<T> {
  return Promise.resolve(v as T | PromiseLike<T>).then((x) => x as T);
}

/**
 * 金山 WebOffice 官方 API（Application / Selection / Range.PasteHtml）。
 *  bundled SDK 中不存在 OnlyOffice 系的 executeMethod('PasteHtml')，故此前侧栏插入会一直失败。
 */
async function pasteViaWpsWebOfficeApplication(
  instance: WebOfficeSdkInstance,
  plain: string,
  html?: string,
): Promise<boolean> {
  try {
    const inst = instance as WebOfficeSdkInstance & {
      Application?: unknown;
      ready?: () => Promise<void>;
    };
    if (typeof inst.ready !== 'function') {
      return false;
    }
    await inst.ready();
    const app = (await awaitMaybe(inst.Application as PromiseLike<unknown> | unknown)) as {
      ActiveDocument?: {
        ActiveWindow?: { Selection?: unknown };
      };
    };
    const selection = await awaitMaybe(
      app.ActiveDocument?.ActiveWindow?.Selection as PromiseLike<unknown> | unknown,
    ) as {
      Range?: unknown;
      InsertAfter?: (text: string) => Promise<void> | void;
    };
    if (!selection) {
      return false;
    }

    const htmlStr = html?.trim();
    if (htmlStr) {
      const range = await awaitMaybe(selection.Range as PromiseLike<unknown> | unknown) as {
        PasteHtml?: (opts: { HTML: string }) => Promise<void> | void;
      };
      if (typeof range?.PasteHtml === 'function') {
        try {
          await range.PasteHtml({ HTML: htmlStr });
          return true;
        } catch (pasteErr) {
          // 部分场景下（如选区在页眉/表格单元格）PasteHtml 会抛错，需回退 InsertAfter
          console.warn('[WebOffice] PasteHtml 失败，尝试 InsertAfter', pasteErr);
        }
      }
    }

    if (typeof selection.InsertAfter === 'function') {
      const visible = plain.replace(/\u200b/g, '').trim();
      if (!visible) {
        return false;
      }
      await selection.InsertAfter(plain);
      return true;
    }
  } catch (e) {
    console.warn('[WebOffice] Application 插入失败', e);
    return false;
  }
  return false;
}

function getSectionTitlesForFragmentInTemplate(sections: TemplateSection[], textFragmentId: string): string[] {
  const out: string[] = [];
  const walk = (secs: TemplateSection[]) => {
    for (const s of secs) {
      if (s.textFragmentId === textFragmentId) {
        out.push(s.title || '(无标题节)');
      }
      if (s.children?.length) {
        walk(s.children);
      }
    }
  };
  walk(sections);
  return out;
}

function bindingAppliesToTemplate(b: TextBinding, tpl: Template): boolean {
  if (b.templateId && b.templateId === tpl.id) {
    return true;
  }
  if (b.frameworkId && b.chapterId && tpl.frameworkId === b.frameworkId) {
    const walk = (secs: TemplateSection[]): boolean => {
      for (const s of secs) {
        if (s.chapterId === b.chapterId) {
          return true;
        }
        if (s.children?.length && walk(s.children)) {
          return true;
        }
      }
      return false;
    };
    return walk(tpl.sections);
  }
  return false;
}

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
  /** 与资源管理四模块一致：text | qualification | evaluation | contract-clause；侧栏 Tab 仅展示同 module */
  module: ResourceModule;
};

/**
 * 范本侧栏资源列表的两段逻辑（与资源管理「文本 / 资格条件 / 评标办法 / 合同条款」对应）：
 *
 * 1）适用范围 + 范本关联（不分 Tab）
 *    - 先用 textFragmentAppliesToTemplateLot：通用（全部标段）或当前范本标段命中。
 *    - 再分「已与本范本关联」vs「尚未绑定但标段可用」：
 *      · 已关联：绑定记录指向本范本，或章节树中显式引用 textFragmentId。
 *      · 资源池：标段适用但未绑定，供插入后再做绑定。
 *
 * 2）当前 Tab 决定展示哪一类资源（四 Tab ↔ 四模块）
 *    - 文本管理 → module `text`
 *    - 资格条件 → `qualification`
 *    - 评标办法 → `evaluation`
 *    - 合同条款 → `contract-clause`
 *    在 1）得到的集合上按 `module` 过滤；同一 Tab 内优先列出已关联，若无则退化为该 Tab 下的资源池。
 */

/** 已与本范本关联、且标段适用的文本资源（绑定 + 章节引用） */
function collectTemplateLinkedTextCards(template: Template, fragments: TextFragment[]) {
  return fragments
    .filter((frag) => textFragmentAppliesToTemplateLot(frag, resolveTemplateLotLevelId(template)))
    .map((frag) => {
      const fromBindings = (frag.bindings ?? []).filter((b) => bindingAppliesToTemplate(b, template));
      const fromSections = getSectionTitlesForFragmentInTemplate(template.sections, frag.id);
      if (fromBindings.length === 0 && fromSections.length === 0) {
        return null;
      }
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

/** 标段适用但未绑定本范本的资源池（避免侧栏空白；插入后可再在资源管理绑定） */
function collectTemplateFallbackTextCards(template: Template, fragments: TextFragment[]): ResourceTextCard[] {
  return fragments
    .filter((frag) => textFragmentAppliesToTemplateLot(frag, resolveTemplateLotLevelId(template)))
    .map((frag) => {
      const linkedByBinding = (frag.bindings ?? []).some((b) => bindingAppliesToTemplate(b, template));
      const linkedBySection = getSectionTitlesForFragmentInTemplate(template.sections, frag.id).length > 0;
      if (linkedByBinding || linkedBySection) {
        return null;
      }
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

/** 侧栏 Tab → TextFragment.module（「合同条款」Tab 对应 `contract-clause`） */
function systemTabToResourceModule(
  tab: 'text' | 'qualification' | 'evaluation' | 'contract' | 'variables' | 'ai',
): ResourceModule | null {
  if (tab === 'variables' || tab === 'ai') return null;
  if (tab === 'contract') return 'contract-clause';
  return tab;
}

type LegacyDocEditor = {
  destroyEditor?: () => void;
  downloadAs?: (format: string) => void;
  executeMethod?: (methodName: string, params?: unknown[], callback?: () => void) => void;
  executeCommand?: (commandName: string, payload?: unknown) => void;
  insertText?: (text: string) => void;
};

type DocEditorLoose = LegacyDocEditor & Record<string, unknown>;

interface WpsTemplateEditorProps {
  template: Template;
  onBack: () => void;
  onSave: (template: Template) => void;
  initialFile?: File | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read blob content'));
        return;
      }
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function WpsTemplateEditor({ template, onBack, onSave, initialFile }: WpsTemplateEditorProps) {
  const globalLoading = useGlobalLoading();
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSystemTab, setActiveSystemTab] = useState<'text' | 'qualification' | 'evaluation' | 'contract' | 'variables' | 'ai'>('text');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ooConnectionHint, setOoConnectionHint] = useState<string | null>(null);
  const [insertHint, setInsertHint] = useState<string | null>(null);
  /** 资源插入失败时弹出重试，不在侧栏堆长文案 */
  const [resourceInsertRetryItem, setResourceInsertRetryItem] = useState<ResourceTextCard | null>(null);
  /** 变量插入失败时同上：仅重试/取消，不提供手动粘贴 */
  const [variableInsertRetryItem, setVariableInsertRetryItem] = useState<TemplateVariable | null>(null);
  const [editorVariables, setEditorVariables] = useState(() =>
    (template.variables ?? []).filter((v) => v.scope !== 'global'),
  );
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [variableModalMode, setVariableModalMode] = useState<'create' | 'edit'>('create');
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null);
  const [newVariableIdentifier, setNewVariableIdentifier] = useState('');
  const [newVariableName, setNewVariableName] = useState('');
  const [newVariableSampleValue, setNewVariableSampleValue] = useState('');
  const [resourceFilterQuery, setResourceFilterQuery] = useState('');
  const [editorVersion, setEditorVersion] = useState(() => (template.version ?? 'V1.0').trim() || 'V1.0');
  const [deleteVariableId, setDeleteVariableId] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  /** 从其他 Tab 切回或窗口聚焦时刷新，以拉取资源管理里最新绑定 */
  const [resourceDataTick, setResourceDataTick] = useState(0);
  const queueDrainingRef = useRef(false);
  const editorInstanceRef = useRef<LegacyDocEditor | WebOfficeSdkInstance | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorContainerIdRef = useRef(`wps-weboffice-${template.id}-${Math.random().toString(36).slice(2, 8)}`);
  const templateRef = useRef(template);
  templateRef.current = template;

  /** 系统预置：全范本通用的招标变量（与「范本变量管理」同源；随可见性刷新） */
  const globalVariableCatalog = useMemo(() => {
    void resourceDataTick;
    return getGlobalTemplateVariables();
  }, [resourceDataTick]);

  /** 金山 WPS / 本地稿统一走服务端导出（优先 mammoth 读磁盘 docx，见 export-html） */
  const requestHtmlFromEditor = useCallback((): Promise<string> => {
    const id = templateRef.current.id;
    return (async () => {
      const r = await fetch(`/api/documents/${encodeURIComponent(id)}/export-html`, { method: 'POST' });
      if (!r.ok) {
        let extra = '';
        try {
          extra = await r.text();
        } catch {
          /* ignore */
        }
        throw new Error(`导出 HTML 失败（HTTP ${r.status}）${extra ? ` — ${extra.slice(0, 240)}` : ''}`);
      }
      return r.text();
    })();
  }, []);

  const handleSave = useCallback(async () => {
    const tpl = templateRef.current;
    const now = new Date().toISOString().split('T')[0];
    try {
      globalLoading.show('正在保存中…');
      setSaving(true);
      setError(null);
      const html = await requestHtmlFromEditor();
      const parsed = parseSectionsFromHTML(html, tpl.id);
      const fragments = getMockTextFragments();
      let merged =
        parsed.length > 0 ? mergeParsedSectionsWithPrevious(tpl.sections, parsed) : tpl.sections;
      merged = applyCanonicalResourceBodiesToSections(merged, tpl, fragments);
      const resolvedVersion = editorVersion.trim() || (tpl.version ?? 'V1.0').trim() || 'V1.0';
      onSave({
        ...tpl,
        version: resolvedVersion,
        sections: merged,
        variables: editorVariables,
        updatedAt: now,
      });
      try {
        const bodyHtml = buildSectionsHtmlWithResources(merged, { ...tpl, sections: merged }, fragments);
        const docBlob = await asBlob(`<html><body>${bodyHtml || `<h1>${escapeHtml(tpl.name)}</h1>`}</body></html>`) as Blob;
        const content = await blobToBase64(docBlob);
        await fetch(`/api/documents/${encodeURIComponent(tpl.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      } catch (syncErr) {
        console.warn('[WpsTemplateEditor] 保存后同步 docx 失败', syncErr);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '同步章节失败';
      console.error(message);
      setError(message);
      const resolvedVersion = editorVersion.trim() || (tpl.version ?? 'V1.0').trim() || 'V1.0';
      onSave({ ...tpl, version: resolvedVersion, variables: editorVariables, updatedAt: now });
    } finally {
      setSaving(false);
      globalLoading.hide();
    }
  }, [editorVariables, editorVersion, globalLoading, onSave, requestHtmlFromEditor]);

  useEffect(() => {
    const raw = template.variables ?? [];
    setEditorVariables(raw.filter((v) => v.scope !== 'global'));
  }, [template.id, template.variables]);

  useEffect(() => {
    setEditorVersion((template.version ?? 'V1.0').trim() || 'V1.0');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅切换范本 id 时重置本地版本号，避免编辑中途随 props 抖动
  }, [template.id]);

  /** 文本 Tab 快捷插入：优先本范本自定义，再补未重复的通用变量 */
  const quickPickVariables = useMemo(() => {
    const custom = editorVariables;
    const rest = globalVariableCatalog.filter((g) => !custom.some((c) => c.key === g.key));
    return [...custom, ...rest].slice(0, 8);
  }, [editorVariables, globalVariableCatalog]);

  useEffect(() => {
    setResourceFilterQuery('');
  }, [activeSystemTab]);

  useEffect(() => {
    const refresh = () => setResourceDataTick((t) => t + 1);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const handleCopyText = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  const enqueuePluginInsert = useCallback(
    async (text: string, html?: string, label?: string): Promise<boolean> => {
      const docId = templateRef.current.id;
      try {
        const resp = await fetch(`/api/documents/${encodeURIComponent(docId)}/insert-queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, html, label }),
        });
        return resp.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const callExecuteMethod = useCallback(
    (ed: DocEditorLoose, methodName: string, params: unknown[] = [], timeoutMs = 900) =>
      new Promise<boolean>((resolve) => {
        if (typeof ed.executeMethod !== 'function') {
          resolve(false);
          return;
        }
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
        } catch {
          finish(false);
        }
      }),
    [],
  );

  const dequeuePluginInsert = useCallback(
    async (): Promise<{ text: string; html?: string; label?: string } | null> => {
      const docId = templateRef.current.id;
      try {
        const resp = await fetch(
          `/api/documents/${encodeURIComponent(docId)}/insert-queue?take=1`,
          { cache: 'no-store' },
        );
        if (!resp.ok) {
          return null;
        }
        const data = (await resp.json()) as { item?: { text: string; html?: string; label?: string } | null };
        return data.item ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  const focusEditorFrame = useCallback(() => {
    try {
      const frame = editorHostRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
      frame?.focus();
      frame?.contentWindow?.focus();
      editorHostRef.current?.focus();
    } catch {
      // ignore focus errors
    }
  }, []);

  const tryInsertIntoDocument = useCallback(async (ed: DocEditorLoose, text: string, html?: string): Promise<boolean> => {
    try {
      // 金山 WebOffice：须走 Application API；executeMethod 为 OO/Asc 插件接口，当前 SDK 实例上不存在
      if (await pasteViaWpsWebOfficeApplication(ed as WebOfficeSdkInstance, text, html)) {
        return true;
      }
      if (html) {
        if (await callExecuteMethod(ed, 'PasteHtml', [html])) return true;
        if (await callExecuteMethod(ed, 'pasteHtml', [html])) return true;
      }
      if (await callExecuteMethod(ed, 'PasteText', [text])) return true;
      if (await callExecuteMethod(ed, 'pasteText', [text])) return true;
      if (await callExecuteMethod(ed, 'InsertText', [text])) return true;
      if (typeof ed.insertText === 'function') {
        ed.insertText(text);
        return true;
      }
      if (typeof ed.executeCommand === 'function') {
        // 强兜底：在编辑器内部执行 Api 脚本插入文本段落（不少版本下比 PasteText 更稳定）
        const script = [
          "var doc = Api.GetDocument();",
          "var p = Api.CreateParagraph();",
          `p.AddText('${toJsStringLiteral(text)}');`,
          "doc.InsertContent([p]);",
        ].join('');
        try { ed.executeCommand('command', script); return true; } catch { /* ignore */ }
      }
    } catch {
      return false;
    }
    return false;
  }, [callExecuteMethod]);

  const tryInsertWithRetries = useCallback(async (text: string, html?: string) => {
    const attempts = [0, 120, 260, 420, 700, 1200, 2000];
    for (const waitMs of attempts) {
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      focusEditorFrame();
      const ed = editorInstanceRef.current as DocEditorLoose | null;
      if (ed && await tryInsertIntoDocument(ed, text, html)) {
        return true;
      }
    }
    return false;
  }, [focusEditorFrame, tryInsertIntoDocument]);

  const insertTextAtCursor = useCallback(
    async (
      text: string,
      labelForHint?: string,
      htmlForInsert?: string,
      options?: { suppressSidebarHints?: boolean },
    ) => {
      const silent = options?.suppressSidebarHints === true;
      const ed = editorInstanceRef.current as DocEditorLoose | null;
      const plainText = toInsertPlainText(text);
      const htmlTrim = htmlForInsert?.trim();
      const shown = (labelForHint ?? plainText) || '内容';
      if (!plainText && !htmlTrim) {
        if (!silent) setInsertHint('无可插入内容');
        return false;
      }
      if (!silent) setInsertHint(null);
      if (ed && await tryInsertWithRetries(plainText || '\u200b', htmlForInsert)) {
        if (!silent) setInsertHint(`已插入：${shown}`);
        return true;
      }
      const queued = await enqueuePluginInsert(plainText || '\u200b', htmlForInsert, shown);
      if (queued) {
        // 不依赖 iframe 内插件：父页立即 dequeue 再 executeMethod 重试一次
        await sleep(220);
        const queuedItem = await dequeuePluginInsert();
        if (queuedItem && (queuedItem.text || queuedItem.html)) {
          const ok = await tryInsertWithRetries(queuedItem.text, queuedItem.html);
          if (ok) {
            if (!silent) setInsertHint(`已插入：${shown}（队列补插成功）`);
            return true;
          }
          // 回拉后仍失败，避免丢失再次入队
          await enqueuePluginInsert(queuedItem.text, queuedItem.html, queuedItem.label);
        }
        if (!silent) {
          setInsertHint(`已加入插入队列：${shown}（本页将自动重试插入）`);
        }
        return false;
      }
      if (!silent) {
        setInsertHint(`插入失败：${shown}`);
      }
      return false;
    },
    [dequeuePluginInsert, enqueuePluginInsert, tryInsertWithRetries],
  );

  /** 不依赖内嵌插件时，由父窗口轮询 insert-queue 并 executeMethod 插入（与 public/wps-plugins 桥接能力等价） */
  useEffect(() => {
    let stopped = false;
    const run = async () => {
      if (stopped || queueDrainingRef.current) {
        return;
      }
      queueDrainingRef.current = true;
      try {
        const item = await dequeuePluginInsert();
        if (!item || (!item.text && !item.html)) {
          return;
        }
        const ok = await tryInsertWithRetries(item.text, item.html);
        if (ok) {
          setInsertHint(item.label ? `已插入：${item.label}` : '已插入队列内容');
          return;
        }
        // 仍失败则回退回队列，避免丢失
        await enqueuePluginInsert(item.text, item.html, item.label);
      } finally {
        queueDrainingRef.current = false;
      }
    };
    const timer = window.setInterval(() => {
      void run();
    }, 1200);
    void run();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [dequeuePluginInsert, enqueuePluginInsert, tryInsertWithRetries]);

  const insertVariableAtCursor = useCallback(async (variable: TemplateVariable) => {
    const key = variable.key.trim();
    if (!key) {
      setInsertHint('变量标识为空');
      return;
    }
    const html = buildVariableInsertHtml(variable);
    const hintLabel = variable.name.trim() || key;
    // 纯文本/队列回退仍写入 key（{{…}}），供导出与招标文件占位替换；HTML 成功时正文展示变量名称并高亮
    const ok = await insertTextAtCursor(key, hintLabel, html, { suppressSidebarHints: true });
    if (ok) {
      setInsertHint(`已插入：${hintLabel}`);
    } else {
      setVariableInsertRetryItem(variable);
    }
  }, [insertTextAtCursor]);

  const normalizeVariableKey = useCallback((identifier: string) => {
    const raw = identifier.trim();
    if (!raw) return '';
    if (raw.startsWith('{{') && raw.endsWith('}}')) {
      return raw;
    }
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
    if (!identifier || !name) {
      setInsertHint('请填写变量标识和变量名称');
      return;
    }
    const key = normalizeVariableKey(identifier);
    const existsInCustom = editorVariables.some((v) => (
      (v.key === key || v.name === name)
      && (variableModalMode === 'create' || v.id !== editingVariableId)
    ));
    if (existsInCustom) {
      setInsertHint(`变量已存在：${key}`);
      return;
    }
    if (variableModalMode === 'create' && globalVariableCatalog.some((g) => g.key === key)) {
      setInsertHint(`「${key}」已在通用型变量中，请换标识或直接使用通用变量插入`);
      return;
    }
    const next = variableModalMode === 'edit' && editingVariableId
      ? editorVariables.map((v) => (
        v.id === editingVariableId
          ? { ...v, name, key, defaultValue: sampleValue, scope: 'template' as const }
          : v
      ))
      : [
        ...editorVariables,
        {
          id: `var-${Date.now()}`,
          name,
          key,
          defaultValue: sampleValue,
          scope: 'template' as const,
        },
      ];
    setEditorVariables(next);
    resetVariableModal();
    setInsertHint(
      variableModalMode === 'edit'
        ? `已更新变量 ${key}`
        : `已新增变量 ${key}`
    );
  }, [
    editorVariables,
    editingVariableId,
    globalVariableCatalog,
    newVariableIdentifier,
    newVariableName,
    newVariableSampleValue,
    normalizeVariableKey,
    resetVariableModal,
    variableModalMode,
  ]);

  const handleDeleteVariable = useCallback((variableId: string) => {
    setDeleteVariableId(variableId);
  }, []);

  const confirmDeleteVariable = useCallback(() => {
    if (!deleteVariableId) return;
    const target = editorVariables.find((v) => v.id === deleteVariableId);
    if (!target) {
      setDeleteVariableId(null);
      return;
    }
    setEditorVariables((prev) => prev.filter((v) => v.id !== deleteVariableId));
    setInsertHint(`已删除变量 ${target.key}`);
    if (editingVariableId === deleteVariableId) {
      resetVariableModal();
    }
    setDeleteVariableId(null);
  }, [deleteVariableId, editorVariables, editingVariableId, resetVariableModal]);

  /** 全量资源片段（mock）；下游会先按标段/通用筛，再拆关联与池 */
  const allFragments = useMemo(
    () => sortByCreatedAtDesc(getMockTextFragments()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意在 sections/绑定变更或聚焦时全量重算
    [template.id, template.updatedAt, resourceDataTick, template.sections],
  );

  /** 标段适用且已关联当前范本（绑定或章节引用），尚未按 Tab 分模块 */
  const linkedTextCards = useMemo(
    () => collectTemplateLinkedTextCards(template, allFragments),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意在 sections/绑定变更或聚焦时全量重算
    [template.id, template.updatedAt, resourceDataTick, template.sections, allFragments],
  );

  /** 标段适用但未绑定本范本；尚未按 Tab 分模块 */
  const fallbackTextCards = useMemo(
    () => collectTemplateFallbackTextCards(template, allFragments),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意在 sections/绑定变更或聚焦时全量重算
    [template.id, template.updatedAt, resourceDataTick, template.sections, allFragments],
  );

  /** 当前 Tab 对应 module 下、已关联本范本的条目 */
  const tabResourceItems = useMemo(() => {
    const m = systemTabToResourceModule(activeSystemTab);
    if (!m) return [];
    return linkedTextCards.filter((it) => it.module === m);
  }, [linkedTextCards, activeSystemTab]);

  /** 当前 Tab 对应 module 下、资源池中未绑定的条目 */
  const fallbackTabResourceItems = useMemo(() => {
    const m = systemTabToResourceModule(activeSystemTab);
    if (!m) return [];
    return fallbackTextCards.filter((it) => it.module === m);
  }, [fallbackTextCards, activeSystemTab]);

  /** 同一 Tab：优先已关联；若无则展示该 Tab 资源池 */
  const displayedResourceItems = tabResourceItems.length > 0 ? tabResourceItems : fallbackTabResourceItems;
  const filteredResourceItems = useMemo(() => {
    const q = resourceFilterQuery.trim().toLowerCase();
    if (!q) {
      return displayedResourceItems;
    }
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

  const insertResourceCardAtCursor = useCallback(async (item: ResourceTextCard) => {
    /** 嵌入了其它资源的正文：先按范本标段展开占位，再规范化边框（避免 WPS 里仍为虚线参考线） */
    const resolved = expandNestedResourceEmbeds(item.copyPayload, resolveTemplateLotLevelId(template), allFragments);
    const forWps = normalizePasteHtmlForWps(resolved);
    const { plainBlock, htmlBlock } = formatResourceInsertPayload(forWps);
    const inserted = await insertTextAtCursor(plainBlock, item.title, htmlBlock, { suppressSidebarHints: true });
    return { inserted: Boolean(inserted), plainBlock, htmlBlock };
  }, [insertTextAtCursor, template.lotLevelId, allFragments]);

  const handleInsertResource = useCallback(async (item: ResourceTextCard) => {
    const result = await insertResourceCardAtCursor(item);
    if (!result.inserted) {
      setResourceInsertRetryItem(item);
      return;
    }
    setInsertHint('已插入到当前光标位置');
  }, [insertResourceCardAtCursor]);

  const aiDemoSuggestions = useMemo(() => {
    return [
      {
        id: 'ai-1',
        title: '扩写“资格条件”段落',
        prompt: '请将资格条件条款扩写为更正式的招标语言，包含合规性、财务能力、履约能力三部分。',
        output: `【演示扩写结果】\n投标人除具备独立法人资格外，还应具有良好的财务状况与履约能力。投标人须提供近三年经审计的财务报告，确保具备承担本项目的资金实力；同时应提供类似项目业绩证明和履约承诺，以保障项目按期高质量实施。`,
      },
      {
        id: 'ai-2',
        title: '扩写“违约责任”段落',
        prompt: '请将违约责任条款扩写为可直接纳入合同附件的版本。',
        output: `【演示扩写结果】\n如乙方未按合同约定期限完成交付，每延期一日，应按合同总价的万分之五向甲方支付违约金。延期超过十五日的，甲方有权单方解除合同并追究由此造成的全部损失。`,
      },
    ];
  }, []);

  const systemTabs = useMemo(() => {
    return [
      { key: 'text' as const, label: '文本管理', icon: FileText },
      { key: 'qualification' as const, label: '资格条件', icon: Shield },
      { key: 'evaluation' as const, label: '评标办法', icon: Scale },
      { key: 'contract' as const, label: '合同条款', icon: FileCheck },
      { key: 'variables' as const, label: '变量库', icon: FilePlus2 },
      { key: 'ai' as const, label: 'AI扩写', icon: Bot },
    ];
  }, []);

  useEffect(() => {
    let disposed = false;
    const hostEl = editorHostRef.current;

    const ensureRemoteDocument = async () => {
      if (initialFile && initialFile.name.toLowerCase().endsWith('.docx')) {
        // 导入 DOCX 时必须以原文件覆盖远端文档，不能依赖 GET 存在性判断。
        // 否则后端 GET 的自动兜底会先创建空白文档，导致导入内容丢失。
        const fileBase64 = await blobToBase64(initialFile);
        const uploadResp = await fetch(`/api/documents/${template.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fileBase64 }),
        });
        if (!uploadResp.ok) {
          throw new Error('导入 DOCX 失败，无法初始化文档');
        }
      } else {
        const existing = await fetch(`/api/documents/${template.id}`, { method: 'GET' });
        if (existing.ok) {
          return;
        }

        try {
          const fragments = getMockTextFragments();
          const html = buildSectionsHtmlWithResources(template.sections, template, fragments);
          const docBlob = await asBlob(`<html><body>${html || `<h1>${template.name}</h1>`}</body></html>`) as Blob;
          const content = await blobToBase64(docBlob);

          const createResp = await fetch(`/api/documents/${template.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          if (!createResp.ok) {
            throw new Error('根据内容生成 DOCX 失败');
          }
        } catch {
          // 回退到最小可用文档，避免因转换失败导致编辑器无法打开
          const fallbackResp = await fetch(`/api/documents/${template.id}/heading`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: template.name || '导入文档' }),
          });
          if (!fallbackResp.ok) {
            throw new Error('回退文档创建失败');
          }
        }
      }

      const verifyResp = await fetch(`/api/documents/${template.id}`, { method: 'GET' });
      if (!verifyResp.ok) {
        throw new Error('文档初始化失败，请重试');
      }
    };

    const loadEditor = async () => {
      try {
        setBooting(true);
        setError(null);
        setOoConnectionHint(null);
        globalLoading.show('正在加载中…');
        await ensureRemoteDocument();

        const initResp = await fetch(`/api/documents/${template.id}/weboffice-init`, { cache: 'no-store' });
        if (!initResp.ok) {
          throw new Error(`无法获取金山 WebOffice 初始化参数（HTTP ${initResp.status}）`);
        }
        const init = (await initResp.json()) as {
          sdkUrl: string;
          appId: string;
          fileId: string;
          officeType?: string;
          token?: string;
          endpoint?: string;
          configured: boolean;
        };

        if (!init.configured) {
          throw new Error(
            '请配置金山 WPS WebOffice：在环境变量中设置 NEXT_PUBLIC_WPS_WEBOFFICE_SDK_URL（JSSDK UMD 地址）与 WPS_WEBOFFICE_APP_ID，并在 WebOffice 控制台完成回调。详见 https://solution.wps.cn/docs/web/quick-start.html'
          );
        }

        await loadWebOfficeSdk(init.sdkUrl);

        if (disposed) {
          return;
        }

        const SDK = window.WebOfficeSDK;
        if (!SDK?.init) {
          throw new Error('WebOffice SDK 未就绪（请确认 JSSDK 地址可访问且返回 web-office-sdk-solution.umd.js）');
        }

        const host = hostEl;
        if (!host) {
          throw new Error('编辑器挂载节点未就绪');
        }

        host.innerHTML = '';
        const mountNode = document.createElement('div');
        mountNode.id = editorContainerIdRef.current;
        mountNode.style.width = '100%';
        mountNode.style.height = '100%';
        host.appendChild(mountNode);

        const prev = editorInstanceRef.current;
        (prev as WebOfficeSdkInstance | null)?.destroy?.();
        (prev as LegacyDocEditor | null)?.destroyEditor?.();

        const OT = SDK.OfficeType as Record<string, string> | undefined;
        const officeType =
          init.officeType || OT?.Writer || OT?.w || 'w';
        const instance = SDK.init({
          mount: mountNode,
          officeType,
          appId: init.appId,
          fileId: init.fileId,
          ...(init.token ? { token: init.token } : {}),
          ...(init.endpoint ? { endpoint: init.endpoint } : {}),
          isListenResize: true,
        });

        editorInstanceRef.current = instance;

        instance.on?.('error', (ev: unknown) => {
          console.warn('[WebOffice]', ev);
          setOoConnectionHint(
            '金山 WebOffice 上报异常。若提示「需实现回调接口 /v3/3rd/users」：请在控制台「回调配置」开启并调试通过「获取用户信息」；其它 403：对齐网关与 WPS_CALLBACK_PUBLIC_BASE_URL，保证 /v3/3rd 公网可达。',
          );
        });

        try {
          await instance.ready?.();
        } catch (readyErr) {
          console.error('[WebOffice] ready failed:', readyErr);
          throw new Error(
            '文档会话未建立（金山侧可能返回 403）。请确认：①控制台「回调配置」已对公网网关调试通过；②隧道/WPS_CALLBACK_PUBLIC_BASE_URL 与网关一致；③应用已审核生效。',
          );
        }

        setLoading(false);
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : '金山 WebOffice 初始化失败';
          setError(message);
        }
      } finally {
        if (!disposed) {
          setBooting(false);
        }
        globalLoading.hide();
      }
    };

    loadEditor();

    return () => {
      disposed = true;
      const inst = editorInstanceRef.current;
      (inst as WebOfficeSdkInstance | null)?.destroy?.();
      (inst as LegacyDocEditor | null)?.destroyEditor?.();
      editorInstanceRef.current = null;
      if (hostEl) {
        hostEl.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 显式追踪范本与导入文件变化
  }, [initialFile, template.id, template.name, template.sections, template.frameworkId]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="shrink-0 min-h-14 py-2 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button type="button" onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <TemplateEditorTitleBlock template={template} editorLabel="金山 WPS WebOffice 在线编辑" />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存并返回
        </button>
      </div>

      <div className="flex-1 flex bg-slate-100 min-h-0">
        <div className="flex-1 relative min-w-0">
          {ooConnectionHint && !booting && (
            <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 bg-amber-50 text-amber-900 text-xs border-b border-amber-200/80 flex gap-2 items-start">
              <p className="flex-1 leading-relaxed min-w-0">{ooConnectionHint}</p>
              <button
                type="button"
                onClick={() => setOoConnectionHint(null)}
                className="shrink-0 text-amber-700/80 hover:text-amber-900"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
          )}
          {booting && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在加载金山 WebOffice…
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-lg px-3 py-2 text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-lg shadow-sm">
              <p className="font-medium">{error}</p>
              <p className="text-xs text-rose-600/90 mt-2 leading-relaxed">
                若无法打开文档：请确认已在金山 WebOffice 控制台创建应用、配置回调域名为当前站点，且环境变量中的{' '}
                <code className="text-[11px] bg-rose-100/80 px-1 rounded">WPS_WEBOFFICE_APP_ID</code> 与 JSSDK 地址正确。
              </p>
            </div>
          )}

          <div ref={editorHostRef} className="w-full h-full" />

          {!loading && !error && (
            <div className="absolute bottom-3 right-3 max-w-sm px-2 py-1.5 rounded bg-slate-900/75 text-white text-[11px] leading-snug">
              保存说明：解析章节结构并保存；引用资源的章节以资源管理正文为准（编辑器内改动不保留）。
            </div>
          )}
        </div>

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

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                        资源管理里暂无可展示数据。请先在左侧 <span className="font-medium text-slate-700">资源管理 → 文本管理</span>{' '}
                        新建并保存文本。
                      </p>
                    ) : (
                      <p>
                        本分类下暂无匹配项（按标题/摘要关键词粗筛）。请切换到侧栏「文本管理」查看资源，或在资源管理中调整名称/描述。
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
                      <div className="text-sm font-semibold text-slate-900">{variableModalMode === 'edit' ? '编辑变量' : '新增变量'}</div>
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

            {activeSystemTab === 'ai' && (
              <div className="space-y-3">
                {aiDemoSuggestions.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-2.5">
                    <div className="text-sm font-medium text-slate-800">{item.title}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      提示词：{item.prompt}
                    </div>
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

            {!['text', 'qualification', 'evaluation', 'contract', 'variables', 'ai'].includes(activeSystemTab) && (
              <div className="text-xs text-slate-400">暂无内容</div>
            )}

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
