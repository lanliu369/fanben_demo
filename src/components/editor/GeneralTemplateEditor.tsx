'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FilePlus2,
  FileText,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GeneralTemplate, TemplateVariable } from '@/types';
import { getGlobalTemplateVariables, getMockTemplates, getMockTextFragments, syncGeneralTemplateToAllTemplates } from '@/lib/mockData';
import {
  collectDedicatedResourceSlotCatalog,
  DEDICATED_RESOURCE_MODULE_LABELS,
  type DedicatedResourceModule,
  type DedicatedResourceSlotItem,
} from '@/lib/dedicatedResourceSlots';
import { ensureGeneralTemplateDocxOnServer, updateGeneralTemplateFromHtml } from '@/lib/general-templates';
import { collectTemplateIdsUsingGeneralTemplate } from '@/lib/generalTemplateSync';
import type { WebOfficeSdkInstance } from '@/lib/webOfficeSdk';
import { loadWebOfficeSdk } from '@/lib/webOfficeSdk';
import { useGlobalLoading } from '@/components/ui/GlobalLoading';
import { SystemDialog } from '@/components/ui/SystemDialog';

type Props = {
  entry: GeneralTemplate;
  onBack: () => void;
  onUpdated: () => void;
};

const DEDICATED_RESOURCE_GROUPS: {
  module: DedicatedResourceModule;
  label: string;
  icon: LucideIcon;
}[] = [
  { module: 'qualification', label: DEDICATED_RESOURCE_MODULE_LABELS.qualification, icon: ShieldCheck },
  { module: 'technical-spec', label: DEDICATED_RESOURCE_MODULE_LABELS['technical-spec'], icon: BookOpen },
  { module: 'evaluation', label: DEDICATED_RESOURCE_MODULE_LABELS.evaluation, icon: Gavel },
  { module: 'contract-clause', label: DEDICATED_RESOURCE_MODULE_LABELS['contract-clause'], icon: ScrollText },
];

type DocEditorLoose = {
  executeMethod?: (name: string, params: unknown[], cb?: () => void) => void;
  insertText?: (text: string) => void;
  executeCommand?: (command: string, script: string) => void;
  destroyEditor?: () => void;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function awaitMaybe<T>(v: T | PromiseLike<T>): Promise<T> {
  return Promise.resolve(v as T | PromiseLike<T>).then((x) => x as T);
}

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

/** 专有资源占位：插入变量名称，范本拼接时按「品类 + 变量名称」匹配正文 */
function buildResourceSlotInsertHtml(slotName: string, module: DedicatedResourceModule): string {
  const name = escapeHtml(slotName.trim());
  const mod = escapeHtml(module);
  return (
    `<span data-resource-slot="1" data-resource-slot-name="${name}" data-resource-module="${mod}" ` +
    `style="display:inline;padding:2px 8px;background:#ffedd5;color:#c2410c;border-radius:6px;` +
    `font-size:inherit;line-height:inherit;font-weight:500;border:1px solid #fdba74;white-space:nowrap;vertical-align:baseline;">${name}</span>`
  );
}

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
    if (typeof inst.ready !== 'function') return false;
    await inst.ready();
    const app = (await awaitMaybe(inst.Application as PromiseLike<unknown> | unknown)) as {
      ActiveDocument?: { ActiveWindow?: { Selection?: unknown } };
    };
    const selection = await awaitMaybe(
      app.ActiveDocument?.ActiveWindow?.Selection as PromiseLike<unknown> | unknown,
    ) as {
      Range?: unknown;
      InsertAfter?: (text: string) => Promise<void> | void;
    };
    if (!selection) return false;

    const htmlStr = html?.trim();
    if (htmlStr) {
      const range = await awaitMaybe(selection.Range as PromiseLike<unknown> | unknown) as {
        PasteHtml?: (opts: { HTML: string }) => Promise<void> | void;
      };
      if (typeof range?.PasteHtml === 'function') {
        try {
          await range.PasteHtml({ HTML: htmlStr });
          return true;
        } catch {
          /* fallback */
        }
      }
    }

    if (typeof selection.InsertAfter === 'function') {
      const visible = plain.replace(/\u200b/g, '').trim();
      if (!visible) return false;
      await selection.InsertAfter(plain);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function GeneralTemplateEditor({ entry, onBack, onUpdated }: Props) {
  const globalLoading = useGlobalLoading();
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ooConnectionHint, setOoConnectionHint] = useState<string | null>(null);
  const [insertHint, setInsertHint] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'variables' | 'resources'>('variables');
  const [activeResourceModule, setActiveResourceModule] = useState<DedicatedResourceModule>('qualification');
  const [resourceQuery, setResourceQuery] = useState('');
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [syncResultMessage, setSyncResultMessage] = useState<string | null>(null);
  const [insertRetry, setInsertRetry] = useState<{
    label: string;
    text: string;
    html?: string;
  } | null>(null);

  const editorReady = !booting && !error;

  const editorInstanceRef = useRef<LegacyDocEditor | WebOfficeSdkInstance | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorContainerIdRef = useRef(`wps-gt-${entry.id}-${Math.random().toString(36).slice(2, 8)}`);

  const globalVariables = useMemo(() => getGlobalTemplateVariables(), []);
  const resourceSlots = useMemo(
    () => collectDedicatedResourceSlotCatalog(getMockTextFragments()),
    // 每次渲染读档，与资源管理保存后回到编辑器时保持一致
  );

  const slotsInActiveModule = useMemo(() => {
    const q = resourceQuery.trim().toLowerCase();
    return resourceSlots
      .filter((item) => item.module === activeResourceModule)
      .filter((item) => !q || item.slotName.toLowerCase().includes(q));
  }, [activeResourceModule, resourceQuery, resourceSlots]);

  useEffect(() => {
    if (activeTab !== 'resources') return;
    const hasCurrent = resourceSlots.some((item) => item.module === activeResourceModule);
    if (hasCurrent) return;
    const first = DEDICATED_RESOURCE_GROUPS.find((group) =>
      resourceSlots.some((item) => item.module === group.module),
    );
    if (first) {
      setActiveResourceModule(first.module);
    }
  }, [activeTab, activeResourceModule, resourceSlots]);

  const templateRefCount = useMemo(() => {
    return collectTemplateIdsUsingGeneralTemplate(entry.id, getMockTemplates()).length;
  }, [entry.id]);

  const flushWpsDocumentBeforeExport = useCallback(async () => {
    const inst = editorInstanceRef.current as WebOfficeSdkInstance | null;
    if (!inst?.save) return;
    try {
      await awaitMaybe(inst.ready?.() as Promise<void> | void);
      const outcome = await awaitMaybe(inst.save());
      const status = outcome?.result;
      if (status === 'ok') {
        await sleep(900);
      } else if (status === 'nochange') {
        await sleep(200);
      }
    } catch (e) {
      console.warn('[GeneralTemplateEditor] flush failed', e);
    }
  }, []);

  const requestHtmlFromEditor = useCallback(async (): Promise<string> => {
    const id = entryRef.current.id;
    await flushWpsDocumentBeforeExport();
    const r = await fetch(`/api/documents/${encodeURIComponent(id)}/export-html`, { method: 'POST' });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`导出 HTML 失败（HTTP ${r.status}）${text ? ` — ${text.slice(0, 200)}` : ''}`);
    }
    const html = await r.text();
    if (!html.trim()) throw new Error('导出内容为空');
    return html;
  }, [flushWpsDocumentBeforeExport]);

  const tryInsertIntoDocument = useCallback(async (ed: DocEditorLoose, text: string, html?: string) => {
    if (await pasteViaWpsWebOfficeApplication(ed as WebOfficeSdkInstance, text, html)) {
      return true;
    }
    if (typeof ed.insertText === 'function') {
      ed.insertText(text);
      return true;
    }
    return false;
  }, []);

  const insertAtCursor = useCallback(async (text: string, html?: string, label?: string) => {
    if (!editorReady) {
      setInsertHint('请等待左侧编辑器加载完成，并在正文中点击定位光标后再插入');
      return false;
    }
    const attempts = [0, 120, 260, 420, 700];
    for (const waitMs of attempts) {
      if (waitMs > 0) await sleep(waitMs);
      const ed = editorInstanceRef.current as DocEditorLoose | null;
      if (ed && (await tryInsertIntoDocument(ed, text, html))) {
        setInsertHint(label ? `已插入：${label}` : '已插入');
        return true;
      }
    }
    if (label) {
      setInsertRetry({ label, text, html });
    } else {
      setInsertHint('插入失败，请确认光标在正文中');
    }
    return false;
  }, [editorReady, tryInsertIntoDocument]);

  const handleInsertVariable = useCallback(async (variable: TemplateVariable) => {
    const key = variable.key.trim();
    if (!key) return;
    const html = buildVariableInsertHtml(variable);
    const label = variable.name.trim() || key;
    await insertAtCursor(key, html, label);
  }, [insertAtCursor]);

  const handleInsertResourceSlot = useCallback(async (item: DedicatedResourceSlotItem) => {
    const slotName = item.slotName.trim();
    if (!slotName) return;
    const html = buildResourceSlotInsertHtml(slotName, item.module);
    await insertAtCursor(slotName, html, slotName);
  }, [insertAtCursor]);

  const performUpdate = useCallback(async () => {
    const current = entryRef.current;
    setSaving(true);
    setError(null);
    try {
      await globalLoading.wrap(async () => {
        const html = await requestHtmlFromEditor();
        await updateGeneralTemplateFromHtml(current.id, html);
        syncGeneralTemplateToAllTemplates(current.id);
      }, '正在更新模版…');
      const count = collectTemplateIdsUsingGeneralTemplate(current.id, getMockTemplates()).length;
      setSyncResultMessage(
        count > 0
          ? `模版已更新，并同步到 ${count} 个引用范本。`
          : '模版已更新。当前暂无范本引用此通用模版。',
      );
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败，请重试');
    } finally {
      setSaving(false);
      globalLoading.hide();
    }
  }, [globalLoading, onUpdated, requestHtmlFromEditor]);

  const handleUpdateClick = useCallback(() => {
    if (templateRefCount > 0) {
      setSyncConfirmOpen(true);
      return;
    }
    void performUpdate();
  }, [performUpdate, templateRefCount]);

  useEffect(() => {
    let disposed = false;
    const hostEl = editorHostRef.current;

    const loadEditor = async () => {
      try {
        setBooting(true);
        setError(null);
        setOoConnectionHint(null);
        globalLoading.show('正在加载编辑器…');
        await ensureGeneralTemplateDocxOnServer(entryRef.current.id, entryRef.current.name);

        const initResp = await fetch(`/api/documents/${entryRef.current.id}/weboffice-init`, { cache: 'no-store' });
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
          callbackPublicBaseConfigured?: boolean;
          callbackPublicBaseReachable?: boolean;
          callbackPublicBaseUrl?: string;
        };

        if (!init.callbackPublicBaseConfigured) {
          throw new Error(
            '须配置 WPS_CALLBACK_PUBLIC_BASE_URL。运行 npm run tunnel:cloudflare 获取地址，写入 .env.local 后重启开发服务。',
          );
        }
        if (init.callbackPublicBaseConfigured && init.callbackPublicBaseReachable === false) {
          throw new Error(
            `WPS 回调公网地址不可达：${init.callbackPublicBaseUrl ?? '（未返回）'}。请更新隧道地址并重启开发服务。`,
          );
        }
        if (!init.configured) {
          throw new Error('请配置金山 WPS WebOffice 环境变量（WPS_WEBOFFICE_APP_ID 等）');
        }

        const sdkUrl = init.sdkUrl.startsWith('http')
          ? init.sdkUrl
          : new URL(init.sdkUrl, window.location.origin).href;
        await loadWebOfficeSdk(sdkUrl);
        if (disposed) return;

        const SDK = window.WebOfficeSDK;
        if (!SDK?.init) throw new Error('WebOffice SDK 未就绪');

        const host = hostEl;
        if (!host) throw new Error('编辑器挂载节点未就绪');

        host.innerHTML = '';
        const mountNode = document.createElement('div');
        mountNode.id = editorContainerIdRef.current;
        mountNode.style.width = '100%';
        mountNode.style.height = '100%';
        host.appendChild(mountNode);

        const prev = editorInstanceRef.current;
        (prev as WebOfficeSdkInstance | null)?.destroy?.();
        (prev as DocEditorLoose | null)?.destroyEditor?.();

        const OT = SDK.OfficeType as Record<string, string> | undefined;
        const instance = SDK.init({
          mount: mountNode,
          officeType: init.officeType || OT?.Writer || OT?.w || 'w',
          appId: init.appId,
          fileId: init.fileId,
          endpoint: init.endpoint || 'https://o.wpsgo.com',
          ...(init.token ? { token: init.token } : {}),
          isListenResize: true,
          customArgs: { w_reload: String(Date.now()) },
        }) as WebOfficeSdkInstance;

        editorInstanceRef.current = instance;
        instance.on?.('fileOpen', (ev: unknown) => {
          const data = ev as { status?: number; message?: string } | undefined;
          if (data && typeof data.status === 'number' && data.status !== 0) {
            setOoConnectionHint(data.message || '文档打开失败，请检查 WPS 回调配置。');
          }
        });
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : '编辑器加载失败');
        }
      } finally {
        if (!disposed) setBooting(false);
        globalLoading.hide();
      }
    };

    void loadEditor();

    return () => {
      disposed = true;
      const inst = editorInstanceRef.current;
      (inst as WebOfficeSdkInstance | null)?.destroy?.();
      (inst as DocEditorLoose | null)?.destroyEditor?.();
      editorInstanceRef.current = null;
      if (hostEl) hostEl.innerHTML = '';
    };
  }, [entry.id]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="shrink-0 min-h-14 py-2 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button type="button" onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{entry.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">通用模版 · 金山 WPS 在线编辑</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUpdateClick}
          disabled={saving || booting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          更新
        </button>
      </div>

      <div className="flex-1 flex bg-slate-100 min-h-0">
        <div className="flex-1 relative min-w-0">
          {ooConnectionHint && !booting && (
            <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 bg-amber-50 text-amber-900 text-xs border-b border-amber-200/80">
              {ooConnectionHint}
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
              {error}
            </div>
          )}
          <div ref={editorHostRef} className="w-full h-full" />
          {!booting && !error && (
            <div className="absolute bottom-3 right-3 max-w-sm px-2 py-1.5 rounded bg-slate-900/75 text-white text-[11px] leading-snug">
              点击「更新」将保存模版并同步到仍引用本模版的范本（未手动改动的关联段落）。
            </div>
          )}
        </div>

        <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">插入辅助</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              在左侧文档中点击定位光标，再点右侧 <span className="font-medium text-slate-600">+</span> 插入变量或专有资源变量名称（全库汇总，与品类无关）
            </p>
            {!editorReady && (
              <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                {booting ? '编辑器加载中，请稍候…' : '编辑器未就绪，请先解决左侧报错后再插入'}
              </p>
            )}
          </div>
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('variables')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors ${
                activeTab === 'variables' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              变量库
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors ${
                activeTab === 'resources' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              专有资源
            </button>
          </div>
          <div className={activeTab === 'resources' ? 'flex-1 min-h-0 flex' : 'flex-1 overflow-y-auto p-3 space-y-2'}>
            {activeTab === 'variables' && (
              <div className="space-y-2">
                {globalVariables.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{v.name}</div>
                      <div className="text-xs text-blue-600 font-mono mt-0.5 truncate">{v.key}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleInsertVariable(v)}
                      disabled={!editorReady}
                      aria-label={`插入变量 ${v.name}`}
                      title="插入到当前光标位置"
                      className="shrink-0 p-1 rounded hover:bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'resources' && (
              <>
                <div className="w-[92px] shrink-0 border-r border-slate-200 p-2 space-y-1">
                  {DEDICATED_RESOURCE_GROUPS.map((group) => {
                    const Icon = group.icon;
                    const isActive = activeResourceModule === group.module;
                    return (
                      <button
                        key={group.module}
                        type="button"
                        onClick={() => {
                          setActiveResourceModule(group.module);
                          setResourceQuery('');
                        }}
                        className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] leading-tight rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-center px-0.5">{group.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-w-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={resourceQuery}
                      onChange={(e) => setResourceQuery(e.target.value)}
                      placeholder="按变量名称查询…"
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  {slotsInActiveModule.length === 0 ? (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {resourceQuery.trim()
                        ? `「${DEDICATED_RESOURCE_MODULE_LABELS[activeResourceModule]}」下没有符合筛选条件的变量名称。`
                        : `「${DEDICATED_RESOURCE_MODULE_LABELS[activeResourceModule]}」暂无已登记的变量名称。请在专用资源管理中填写「变量名称」（不限品类）。`}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {slotsInActiveModule.map((item) => (
                        <div
                          key={`${item.module}-${item.slotName}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                        >
                          <div className="min-w-0 text-sm font-medium text-slate-800 truncate font-mono">
                            {item.slotName}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleInsertResourceSlot(item)}
                            disabled={!editorReady}
                            aria-label={`插入变量名称 ${item.slotName}`}
                            title="插入变量名称到当前光标位置"
                            className="shrink-0 p-1 rounded hover:bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {insertHint ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1">{insertHint}</p>
                  ) : null}
                </div>
              </>
            )}
            {activeTab === 'variables' && insertHint ? (
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">{insertHint}</p>
            ) : null}
          </div>
        </aside>
      </div>

      <SystemDialog
        open={insertRetry !== null}
        title="插入失败"
        message="未能将内容写入编辑器当前光标位置，是否重新尝试插入？"
        tone="warning"
        variant="confirm"
        confirmText="重试"
        cancelText="取消"
        onClose={() => setInsertRetry(null)}
        onConfirm={() => {
          const item = insertRetry;
          setInsertRetry(null);
          if (item) void insertAtCursor(item.text, item.html, item.label);
        }}
      />

      <SystemDialog
        open={syncConfirmOpen}
        title="更新并同步范本"
        message={`确定更新通用模版「${entry.name}」？将同步到 ${templateRefCount} 个引用范本（仅更新仍有关联标记且未手动改动的段落）。`}
        tone="info"
        variant="confirm"
        confirmText="更新"
        onConfirm={() => {
          setSyncConfirmOpen(false);
          void performUpdate();
        }}
        onClose={() => setSyncConfirmOpen(false)}
      />

      <SystemDialog
        open={syncResultMessage !== null}
        title="更新完成"
        message={syncResultMessage ?? ''}
        tone="info"
        variant="alert"
        confirmText="知道了"
        onConfirm={() => setSyncResultMessage(null)}
        onClose={() => setSyncResultMessage(null)}
      />
    </div>
  );
}

type LegacyDocEditor = DocEditorLoose;
