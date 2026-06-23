import type {
  BidDocument,
  LotLevelPath,
  Template,
  TemplateSection,
  TemplateVariable,
  TextFragment,
  TextBinding,
} from '@/types';
import { bindingMatchesSection, bindingTouchesTemplate } from '@/lib/textBindingMatch';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { expandNestedResourceEmbeds } from '@/lib/resourceEmbedHtml';
import { syncResourceBlocksInHtml } from '@/lib/quotedBlockHtml';
import {
  collectFragmentIdsFromSection,
  sectionReferencesFragment,
  templateReferencesFragment,
} from '@/lib/textFragmentReference';
import { appendDataAudit, getMockActor } from '@/lib/dataAudit';
import {
  getClassificationStore,
  migrateLegacyCategoryId,
  normalizeTemplateLotFields,
  normalizeTextFragmentLotScope,
  resolveLotLevelPath,
  templateFieldsFromLotPath,
} from '@/lib/classification';
import { SPIC_DEVICE_PROCUREMENT_202603_RESOURCES } from '@/lib/seed/spicDeviceProcurement202603Resources';

type SoftRow = { id: string; deletedAt?: string; deletedBy?: string };

function mergeActivePreserveDeleted<T extends SoftRow>(active: T[], storedFull: T[]): T[] {
  const deletedRows = storedFull.filter((x) => x.deletedAt);
  const activeIds = new Set(active.map((x) => x.id));
  return [...active, ...deletedRows.filter((d) => !activeIds.has(d.id))];
}


const STORAGE_KEYS = {
  textFragments: 'oo-text-fragments-spic202603',
  textFragmentsSeedVersion: 'oo-text-fragments-spic202603-version',
  templates: 'oo-templates',
  bidDocuments: 'oo-bid-documents',
  globalTemplateVars: 'oo-global-template-variables',
} as const;

/** 资源种子版本：变更后浏览器自动重置为最新 Mock 数据 */
const TEXT_FRAGMENTS_SEED_VERSION = 'spic-202603-section-merge-v5';

const LEGACY_TEXT_FRAGMENTS_KEY = 'oo-text-fragments';

/** 现行种子条数（按节合并后约 77 条）；旧版「每段一条」缓存约 200～400 条 */
const TEXT_FRAGMENTS_SEED_EXPECTED_COUNT = SPIC_DEVICE_PROCUREMENT_202603_RESOURCES.length;

const SEED_MODULE_COUNTS = SPIC_DEVICE_PROCUREMENT_202603_RESOURCES.reduce(
  (acc, f) => {
    const m = f.module ?? 'text';
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

function moduleCountsOf(fragments: TextFragment[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const f of fragments) {
    if (f.deletedAt) continue;
    const m = f.module ?? 'text';
    acc[m] = (acc[m] ?? 0) + 1;
  }
  return acc;
}

function hasSpicSeedContent(stored: TextFragment[]): boolean {
  return stored.some((f) => !f.deletedAt && f.id.startsWith('spic-202603-'));
}

/** 检测浏览器里是否仍为旧版/空缓存（强刷不会清除 localStorage） */
function isStaleTextFragmentCache(storedVersion: string | null, stored: TextFragment[]): boolean {
  if (storedVersion !== TEXT_FRAGMENTS_SEED_VERSION) return true;
  const active = stored.filter((f) => !f.deletedAt);
  if (!hasSpicSeedContent(stored)) return true;
  if (active.length !== TEXT_FRAGMENTS_SEED_EXPECTED_COUNT) return true;
  const storedCounts = moduleCountsOf(stored);
  for (const [mod, count] of Object.entries(SEED_MODULE_COUNTS)) {
    if ((storedCounts[mod] ?? 0) !== count) return true;
  }
  if (active.length > TEXT_FRAGMENTS_SEED_EXPECTED_COUNT + 40) return true;
  return active.some(
    (f) =>
      (f.module === 'qualification' && !f.name.startsWith('1.4 投标人资格要求'))
      || f.name.includes('第六章 投标文件格式｜4.请投标人仔细阅读')
      || f.name.includes('第六章 投标文件格式｜3.【】里内容可删除')
      || f.name.includes('重要提示：'),
  );
}

/** 招标范本通用变量（全范本变量库展示；不写入单个 Template.variables） */
const GLOBAL_TEMPLATE_VARIABLES_SEED: TemplateVariable[] = [
  { id: 'gv-tenderer', name: '招标人', key: '{{招标人}}', scope: 'global', defaultValue: '（填写招标人全称）' },
  { id: 'gv-agency', name: '招标代理机构', key: '{{招标代理机构}}', scope: 'global', defaultValue: '（如有，填写机构全称）' },
  { id: 'gv-project-name', name: '项目名称', key: '{{项目名称}}', scope: 'global', defaultValue: '（填写立项批复或对外披露的项目名称）' },
  { id: 'gv-project-code', name: '招标编号', key: '{{招标编号}}', scope: 'global', defaultValue: 'ZB-2026-0001' },
  { id: 'gv-location', name: '建设地点', key: '{{建设地点}}', scope: 'global', defaultValue: '（省/市/区及详细地址）' },
  { id: 'gv-duration', name: '工期', key: '{{工期}}', scope: 'global', defaultValue: '180日历天' },
  { id: 'gv-control-price', name: '招标控制价', key: '{{招标控制价}}', scope: 'global', defaultValue: '（人民币，大小写）' },
  { id: 'gv-bid-deadline', name: '投标文件递交截止时间', key: '{{投标文件递交截止时间}}', scope: 'global', defaultValue: '2026年__月__日__时__分' },
  { id: 'gv-open-info', name: '开标时间与地点', key: '{{开标时间与地点}}', scope: 'global', defaultValue: '（填写开标日期时间、会议室或电子开标说明）' },
  { id: 'gv-contact', name: '联系人', key: '{{联系人}}', scope: 'global', defaultValue: '（姓名）' },
  { id: 'gv-phone', name: '联系电话', key: '{{联系电话}}', scope: 'global', defaultValue: '010-________' },
  { id: 'gv-email', name: '电子邮箱', key: '{{电子邮箱}}', scope: 'global', defaultValue: '（邮箱地址）' },
];

function stripTemplateVariableMetaDeprecated(v: TemplateVariable): TemplateVariable {
  const { required: _r, ...rest } = v;
  return rest as TemplateVariable;
}

export function getGlobalTemplateVariables(): TemplateVariable[] {
  if (typeof window === 'undefined') {
    return deepClone(GLOBAL_TEMPLATE_VARIABLES_SEED);
  }
  const raw = deepClone(readStorage(STORAGE_KEYS.globalTemplateVars, GLOBAL_TEMPLATE_VARIABLES_SEED));
  return raw.map(stripTemplateVariableMetaDeprecated);
}

/** 持久化「范本公共变量」（与范本编辑器变量库「通用型」同源） */
export function setGlobalTemplateVariables(vars: TemplateVariable[]) {
  writeStorage(STORAGE_KEYS.globalTemplateVars, deepClone(vars));
}

function cloneTemplateSectionsWithNewIds(
  sections: TemplateSection[],
  newTemplateId: string,
  idMap: Map<string, string>,
  parentNewId: string | undefined,
  idCounter: { n: number },
): TemplateSection[] {
  return sections.map((s) => {
    idCounter.n += 1;
    const newId = `sec-${Date.now()}-${idCounter.n}-${Math.random().toString(36).slice(2, 9)}`;
    idMap.set(s.id, newId);
    const children = s.children?.length
      ? cloneTemplateSectionsWithNewIds(s.children, newTemplateId, idMap, newId, idCounter)
      : undefined;
    return {
      ...s,
      id: newId,
      templateId: newTemplateId,
      /** 子层使用新父节 ID；顶层保留原 parentId（多为框架大纲关联） */
      parentId: parentNewId !== undefined ? parentNewId : s.parentId,
      children,
    };
  });
}

function flattenSectionTitles(sections: TemplateSection[]): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (secs: TemplateSection[]) => {
    secs.forEach((s) => {
      m.set(s.id, s.title || '');
      if (s.children?.length) walk(s.children);
    });
  };
  walk(sections);
  return m;
}

/** 复制范本时由用户填写的新范本元信息（标段 / 名称等） */
export interface DuplicateTemplateOptions {
  name: string;
  description?: string;
  lotLevelId: string;
  /** 留空则按目标标段下已有范本数量自动生成 V{n}.0 */
  version?: string;
}

/** 复制范本：章节正文、自定义变量与资源侧「范本节」绑定关系一并复制到新范本 */
export function duplicateMockTemplate(
  sourceId: string,
  options?: DuplicateTemplateOptions,
): Template | null {
  if (typeof window !== 'undefined') {
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
    mockTextFragments = readStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }
  const source = mockTemplates.find((t) => t.id === sourceId && !t.deletedAt);
  if (!source) {
    return null;
  }
  const now = new Date().toISOString().split('T')[0];
  const newTemplateId = `tpl-${Date.now()}`;
  const idMap = new Map<string, string>();
  const newSections = cloneTemplateSectionsWithNewIds(
    source.sections,
    newTemplateId,
    idMap,
    undefined,
    { n: 0 },
  );
  const baseName = source.name.trim();

  let copyLabel: string;
  let newTemplate: Template;

  if (options) {
    const trimmedName = options.name.trim();
    if (!trimmedName) {
      return null;
    }
    const lotLevelId = options.lotLevelId;
    const path = resolveLotLevelPath(lotLevelId);
    if (!path) {
      return null;
    }
    copyLabel = trimmedName;
    const existingForLot = mockTemplates.filter(
      (t) => t.lotLevelId === lotLevelId && !t.deletedAt,
    );
    const autoVersion = `V${existingForLot.length + 1}.0`;
    const nextVersion = options.version?.trim() || autoVersion;
    const desc = options.description?.trim();
    newTemplate = {
      ...source,
      id: newTemplateId,
      name: copyLabel,
      description: desc || undefined,
      ...templateFieldsFromLotPath(path),
      version: nextVersion,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      sections: newSections,
      variables: deepClone(source.variables ?? []).filter((v) => v.scope !== 'global'),
    };
  } else {
    copyLabel = `${baseName}（副本）`;
    newTemplate = {
      ...source,
      id: newTemplateId,
      name: copyLabel,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      sections: newSections,
      variables: deepClone(source.variables ?? []).filter((v) => v.scope !== 'global'),
    };
  }
  const newTitles = flattenSectionTitles(newSections);

  mockTemplates = [...mockTemplates, newTemplate];
  writeStorage(STORAGE_KEYS.templates, mockTemplates);

  mockTextFragments = mockTextFragments.map((f) => {
    const bindings = f.bindings ?? [];
    const extras: TextBinding[] = [];
    for (const b of bindings) {
      if (b.templateId !== sourceId || !b.templateSectionId) continue;
      const newSecId = idMap.get(b.templateSectionId);
      if (!newSecId) continue;
      const dup = bindings.some((x) => x.templateId === newTemplateId && x.templateSectionId === newSecId);
      if (dup) continue;
      extras.push({
        ...b,
        id: `bind-${Date.now()}-${f.id}-${newSecId}-${Math.random().toString(36).slice(2, 7)}`,
        templateId: newTemplateId,
        templateSectionId: newSecId,
        templateName: copyLabel,
        sectionTitle: newTitles.get(newSecId) ?? b.sectionTitle,
        order: bindings.length + extras.length + 1,
      });
    }
    if (extras.length === 0) return f;
    return { ...f, bindings: [...bindings, ...extras] };
  });
  writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);

  appendDataAudit({
    scope: 'template',
    action: 'create',
    entityId: newTemplateId,
    label: copyLabel,
    detail: options
      ? `复制自 ${source.name}（${sourceId}），新标段 ${options.lotLevelId}`
      : `一键复制自 ${source.name}（${sourceId}）`,
    actor: getMockActor(),
  });

  return deepClone(newTemplate);
}

/** 合并展示/填写用：全系统通用变量 + 当前范本自定义；同 key 时以范本内为准 */
export function getEffectiveTemplateVariables(template: Template): TemplateVariable[] {
  const globals = getGlobalTemplateVariables();
  const custom = (template.variables ?? []).filter((v) => v.scope !== 'global');
  const byKey = new Map<string, TemplateVariable>();
  for (const g of globals) {
    byKey.set(g.key, g);
  }
  for (const c of custom) {
    byKey.set(c.key, c);
  }
  return [...byKey.values()];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return deepClone(fallback);
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return deepClone(fallback);
    }
    return JSON.parse(raw) as T;
  } catch {
    return deepClone(fallback);
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage write errors
  }
}

/** 从标段 ID 解析完整路径 */
export function getLotLevelPath(lotLevelId: string): LotLevelPath | null {
  return resolveLotLevelPath(migrateLegacyCategoryId(lotLevelId));
}

/** 标段展示标签（业务板块 / 业务类型 / 标段名） */
export function getLotLevelLabel(lotLevelId: string) {
  const path = getLotLevelPath(lotLevelId);
  if (!path) return null;
  return {
    lotLevelName: path.lotLevelName,
    businessSectorName: path.businessSectorName,
    businessTypeDisplayName: path.businessTypeDisplayName,
    businessPath: [path.businessSectorName, path.businessTypeDisplayName, path.domainLevelName, path.lotLevelName]
      .filter(Boolean)
      .join(' / '),
  };
}

/** @deprecated 使用 getLotLevelLabel */
export const getCategoryLabel = getLotLevelLabel;

/** 获取全部标段扁平列表 */
export function getAllLotLevels() {
  const store = getClassificationStore();
  return store.lotLevels.map((lot) => {
    const path = resolveLotLevelPath(lot.id, store);
    return { ...lot, path };
  });
}

/** @deprecated */
export const getAllCategories = getAllLotLevels;

// ─── Mock 文本片段数据（国家电投设备采购招标文件范本 2026 按段落拆分）────────────────
const defaultTextFragments: TextFragment[] = SPIC_DEVICE_PROCUREMENT_202603_RESOURCES;

function loadTextFragmentsFromStorage(): TextFragment[] {
  if (typeof window === 'undefined') {
    return deepClone(defaultTextFragments);
  }
  try {
    const storedVersion = window.localStorage.getItem(STORAGE_KEYS.textFragmentsSeedVersion);
    const stored = readStorage(STORAGE_KEYS.textFragments, defaultTextFragments);
    const legacyExists = window.localStorage.getItem(LEGACY_TEXT_FRAGMENTS_KEY) !== null;
    const shouldReset =
      isStaleTextFragmentCache(storedVersion, stored)
      || (legacyExists && !hasSpicSeedContent(stored));
    if (shouldReset) {
      window.localStorage.removeItem(STORAGE_KEYS.textFragments);
      window.localStorage.removeItem(LEGACY_TEXT_FRAGMENTS_KEY);
      window.localStorage.setItem(STORAGE_KEYS.textFragmentsSeedVersion, TEXT_FRAGMENTS_SEED_VERSION);
      writeStorage(STORAGE_KEYS.textFragments, defaultTextFragments);
      return deepClone(defaultTextFragments);
    }
    return stored;
  } catch {
    /* ignore */
  }
  return readStorage(STORAGE_KEYS.textFragments, defaultTextFragments);
}

export let mockTextFragments: TextFragment[] = deepClone(defaultTextFragments);

export function getMockTextFragments(): TextFragment[] {
  if (typeof window !== 'undefined') {
    mockTextFragments = loadTextFragmentsFromStorage();
  } else if (mockTextFragments.length === 0) {
    mockTextFragments = deepClone(defaultTextFragments);
  }
  return deepClone(mockTextFragments)
    .filter((f) => !f.deletedAt)
    .map((f) => normalizeTextFragment(f));
}

export function setMockTextFragments(activeFragments: TextFragment[]) {
  const stored =
    typeof window !== 'undefined'
      ? readStorage(STORAGE_KEYS.textFragments, mockTextFragments)
      : mockTextFragments;
  mockTextFragments = mergeActivePreserveDeleted(activeFragments, stored);
  writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);
}

export function softDeleteTextFragment(id: string, actor?: string) {
  const actorResolved = actor ?? getMockActor();
  if (typeof window !== 'undefined') {
    mockTextFragments = readStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }
  const now = new Date().toISOString();
  const label = mockTextFragments.find((f) => f.id === id)?.name;
  mockTextFragments = mockTextFragments.map((f) =>
    f.id === id ? { ...f, deletedAt: now, deletedBy: actorResolved } : f,
  );
  writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  appendDataAudit({
    scope: 'text',
    action: 'delete',
    entityId: id,
    label,
    actor: actorResolved,
  });
}

// ─── Mock 范本数据（跨页面共享，用于文本引用同步）────────────────────────────

export let mockTemplates: Template[] = [];

export function getMockTemplates(): Template[] {
  if (typeof window !== 'undefined') {
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
    let migrated = false;
    mockTemplates = mockTemplates.map((t) => {
      const st = (t as { status?: string }).status;
      if (st === 'archived') {
        migrated = true;
        return { ...t, status: 'published' as const };
      }
      return t;
    });
    if (migrated) {
      writeStorage(STORAGE_KEYS.templates, mockTemplates);
    }
  }
  return deepClone(mockTemplates)
    .filter((t) => !t.deletedAt)
    .map((t) => normalizeTemplateLotFields(t));
}

export function setMockTemplates(activeTemplates: Template[]) {
  const stored =
    typeof window !== 'undefined' ? readStorage(STORAGE_KEYS.templates, mockTemplates) : mockTemplates;
  mockTemplates = mergeActivePreserveDeleted(activeTemplates, stored);
  writeStorage(STORAGE_KEYS.templates, mockTemplates);
}

export function softDeleteTemplate(id: string, actor?: string) {
  const actorResolved = actor ?? getMockActor();
  if (typeof window !== 'undefined') {
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
  }
  const now = new Date().toISOString();
  const label = mockTemplates.find((t) => t.id === id)?.name;
  mockTemplates = mockTemplates.map((t) =>
    t.id === id ? { ...t, deletedAt: now, deletedBy: actorResolved } : t,
  );
  writeStorage(STORAGE_KEYS.templates, mockTemplates);
  appendDataAudit({
    scope: 'template',
    action: 'delete',
    entityId: id,
    label,
    actor: actorResolved,
  });
}

function getBindingsForFragment(textFragmentId: string): TextBinding[] {
  const frag = mockTextFragments.find(f => f.id === textFragmentId);
  return frag?.bindings ?? [];
}

/** 兼容旧版：草稿/发布态合并为单一正文，并补齐版本与范本同步游标 */
export function normalizeTextFragment(f: TextFragment): TextFragment {
  const legacy = f as TextFragment & { status?: string; draftContent?: string };
  const content = legacy.draftContent?.trim() ? legacy.draftContent : (legacy.content ?? '');
  const cv = typeof legacy.contentVersion === 'number' ? legacy.contentVersion : 1;
  let templateSyncedVersion = legacy.templateSyncedVersion;
  if (!templateSyncedVersion || Object.keys(templateSyncedVersion).length === 0) {
    const tids = new Set<string>();
    for (const b of legacy.bindings ?? []) {
      if (b.templateId) tids.add(b.templateId);
    }
    templateSyncedVersion = Object.fromEntries([...tids].map((id) => [id, cv])) as Record<string, number>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 剥离历史字段
  const { status: _s, draftContent: _d, ...rest } = legacy as TextFragment & {
    status?: unknown;
    draftContent?: unknown;
  };
  return normalizeTextFragmentLotScope({
    ...rest,
    content,
    contentVersion: cv,
    templateSyncedVersion,
    versions: legacy.versions ?? [],
  });
}

/** 绑定记录 + 范本章节引用（textFragmentId / 正文内嵌块），汇总引用该资源的范本 ID */
export function collectTemplateIdsUsingFragment(frag: TextFragment): string[] {
  if (typeof window !== 'undefined') {
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
  }
  const ids = new Set<string>();
  for (const b of frag.bindings ?? []) {
    if (b.templateId) ids.add(b.templateId);
  }
  const fid = frag.id;
  for (const t of mockTemplates) {
    if (t.deletedAt) continue;
    if (templateReferencesFragment(t, fid)) {
      ids.add(t.id);
    }
  }
  return [...ids];
}

/**
 * 范本编辑器侧栏插入资源时立即写入绑定（不依赖保存后 mammoth 是否保留 data-text-fragment-id）。
 */
export function upsertTemplateFragmentBinding(
  template: Pick<Template, 'id' | 'name'>,
  fragmentId: string,
  opts?: { sectionId?: string; sectionTitle?: string },
): void {
  if (typeof window !== 'undefined') {
    mockTextFragments = readStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }
  const fid = fragmentId.trim();
  if (!fid) return;

  let changed = false;
  mockTextFragments = mockTextFragments.map((frag) => {
    if (frag.id !== fid) return frag;
    const bindings = [...(frag.bindings ?? [])];
    const sectionId = opts?.sectionId?.trim();
    const exists = bindings.some((b) => {
      if (b.templateId !== template.id) return false;
      if (sectionId) return b.templateSectionId === sectionId;
      return !b.templateSectionId || b.sectionTitle === (opts?.sectionTitle ?? '编辑器内插入');
    });
    if (exists) return frag;

    bindings.push({
      id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      textFragmentId: fid,
      templateId: template.id,
      ...(sectionId ? { templateSectionId: sectionId } : {}),
      templateName: template.name,
      sectionTitle: opts?.sectionTitle?.trim() || '编辑器内插入',
      order: bindings.length + 1,
    });
    changed = true;
    return { ...frag, bindings };
  });

  if (changed) {
    writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }
}

/**
 * 范本保存后：根据章节 textFragmentId / 正文内嵌引用块，回写资源 bindings，供「范本使用统计」展示。
 */
export function syncTemplateFragmentBindingsFromSections(
  template: Template,
  extraFragmentIds: string[] = [],
): void {
  if (typeof window !== 'undefined') {
    mockTextFragments = readStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }

  const refsByFragment = new Map<string, Array<{ sectionId: string; sectionTitle: string }>>();

  const walk = (sections: TemplateSection[]) => {
    for (const s of sections) {
      for (const fid of collectFragmentIdsFromSection(s)) {
        const arr = refsByFragment.get(fid) ?? [];
        if (!arr.some((x) => x.sectionId === s.id)) {
          arr.push({ sectionId: s.id, sectionTitle: s.title.trim() || '(无标题节)' });
        }
        refsByFragment.set(fid, arr);
      }
      if (s.children?.length) {
        walk(s.children);
      }
    }
  };
  walk(template.sections);

  for (const fid of extraFragmentIds) {
    const id = fid.trim();
    if (!id) continue;
    if (!refsByFragment.has(id) || refsByFragment.get(id)!.length === 0) {
      refsByFragment.set(id, [{ sectionId: `insert-${template.id}-${id}`, sectionTitle: '编辑器内插入' }]);
    }
  }

  let changed = false;
  mockTextFragments = mockTextFragments.map((frag) => {
    const refs = refsByFragment.get(frag.id) ?? [];
    let bindings = [...(frag.bindings ?? [])];

    bindings = bindings.filter((b) => {
      if (b.templateId !== template.id) return true;
      if (!b.templateSectionId) return true;
      if (b.templateSectionId.startsWith('insert-')) {
        return refs.some((r) => r.sectionId === b.templateSectionId);
      }
      return refs.some((r) => r.sectionId === b.templateSectionId);
    });

    for (const r of refs) {
      const exists = bindings.some(
        (b) => b.templateId === template.id && b.templateSectionId === r.sectionId,
      );
      if (!exists) {
        bindings.push({
          id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          textFragmentId: frag.id,
          templateId: template.id,
          templateSectionId: r.sectionId,
          templateName: template.name,
          sectionTitle: r.sectionTitle,
          order: bindings.length + 1,
        });
      }
    }

    if (refs.length === 0) {
      const hasTemplateBinding = bindings.some((b) => b.templateId === template.id);
      if (extraFragmentIds.includes(frag.id) && !hasTemplateBinding) {
        bindings.push({
          id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          textFragmentId: frag.id,
          templateId: template.id,
          templateName: template.name,
          sectionTitle: '编辑器内插入',
          order: bindings.length + 1,
        });
      }
    }

    if (JSON.stringify(bindings) === JSON.stringify(frag.bindings ?? [])) {
      return frag;
    }
    changed = true;
    return { ...frag, bindings };
  });

  if (changed) {
    writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  }
}

export interface FragmentTemplateUsageRow {
  templateId: string;
  templateName: string;
  /** 范本内嵌章节是否已对齐到当前资源 contentVersion */
  synced: boolean;
  /** 展示用：首次引用取范本更新时间，同步过后取资源更新时间 */
  referencedAt?: string;
  businessSectorName?: string;
  businessTypeDisplayName?: string;
  lotLevelName?: string;
}

/** 范本引用与同步状态（用于资源详情「范本使用统计」） */
export function getFragmentTemplateUsage(frag: TextFragment): {
  rows: FragmentTemplateUsageRow[];
  pendingCount: number;
} {
  if (typeof window !== 'undefined') {
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
  }
  const cv = frag.contentVersion ?? 1;
  const ts = frag.templateSyncedVersion ?? {};
  const rows: FragmentTemplateUsageRow[] = [];
  for (const tid of collectTemplateIdsUsingFragment(frag)) {
    const t = mockTemplates.find((x) => x.id === tid && !x.deletedAt);
    if (!t) continue;
    const synced = (ts[tid] ?? 0) >= cv;
    const hasSyncedBefore = (ts[tid] ?? 0) > 0;
    rows.push({
      templateId: tid,
      templateName: t.name,
      synced,
      referencedAt: hasSyncedBefore ? frag.updatedAt : t.updatedAt,
      businessSectorName: t.businessSectorName,
      businessTypeDisplayName: t.businessTypeDisplayName,
      lotLevelName: t.lotLevelName,
    });
  }
  return {
    rows,
    pendingCount: rows.filter((r) => !r.synced).length,
  };
}

function sectionInheritsFromFragment(
  tpl: Template,
  sec: TemplateSection,
  textFragmentId: string,
  bindings: TextBinding[],
): boolean {
  if (sectionReferencesFragment(sec, textFragmentId)) {
    return true;
  }
  return bindings.some((b) => bindingMatchesSection(b, tpl, sec));
}

export function updateMockTemplateTextFragment(textFragmentId: string, newContent: string, updatedAt: string) {
  const bindings = getBindingsForFragment(textFragmentId);

  const updateSectionsForTemplate = (tpl: Template, sections: TemplateSection[]): TemplateSection[] => {
    const lotLevelId = resolveTemplateLotLevelId(tpl);
    const expandedContent = expandNestedResourceEmbeds(newContent, lotLevelId, mockTextFragments);
    return sections.map(sec => {
      const updated = { ...sec };
      if (sectionInheritsFromFragment(tpl, sec, textFragmentId, bindings)) {
        updated.content = expandedContent;
        if (!sec.textFragmentId) {
          updated.textFragmentId = textFragmentId;
        }
      } else if ((updated.content ?? '').includes('data-text-fragment-id')) {
        updated.content = syncResourceBlocksInHtml(updated.content ?? '', textFragmentId, expandedContent);
      }
      if (sec.children?.length) {
        updated.children = updateSectionsForTemplate(tpl, sec.children);
      }
      return updated;
    });
  };

  mockTemplates = mockTemplates.map(tpl => {
    if (tpl.deletedAt) {
      return tpl;
    }
    const serialized = JSON.stringify(tpl.sections);
    const hasDirectId = serialized.includes(`"textFragmentId":"${textFragmentId}"`);
    const hasEmbedded = serialized.includes(`data-text-fragment-id="${textFragmentId}"`);
    const hasTplBinding =
      bindings.length > 0 && bindings.some((b) => bindingTouchesTemplate(b, tpl));
    if (!hasDirectId && !hasTplBinding && !hasEmbedded) {
      return tpl;
    }
    return {
      ...tpl,
      sections: updateSectionsForTemplate(tpl, tpl.sections),
      updatedAt,
    };
  });
  writeStorage(STORAGE_KEYS.templates, mockTemplates);
}

/** 将当前资源正文写入所有引用该资源的范本章节（跳过已删除范本），并把各范本的「已同步」游标更新到当前 contentVersion */
export function syncTextFragmentToAllTemplates(textFragmentId: string) {
  if (typeof window !== 'undefined') {
    mockTextFragments = readStorage(STORAGE_KEYS.textFragments, mockTextFragments);
    mockTemplates = readStorage(STORAGE_KEYS.templates, mockTemplates);
  }
  const frag = mockTextFragments.find((f) => f.id === textFragmentId && !f.deletedAt);
  if (!frag) return;
  const cv = frag.contentVersion ?? 1;
  const html = frag.content ?? '';
  const now = new Date().toISOString().split('T')[0];
  updateMockTemplateTextFragment(textFragmentId, html, now);
  const tids = collectTemplateIdsUsingFragment(frag);
  const next: Record<string, number> = { ...(frag.templateSyncedVersion ?? {}) };
  for (const tid of tids) {
    const t = mockTemplates.find((x) => x.id === tid);
    if (t && !t.deletedAt) {
      next[tid] = cv;
    }
  }
  mockTextFragments = mockTextFragments.map((f) =>
    f.id === textFragmentId ? { ...f, templateSyncedVersion: next } : f,
  );
  writeStorage(STORAGE_KEYS.textFragments, mockTextFragments);
  appendDataAudit({
    scope: 'text',
    action: 'update',
    entityId: textFragmentId,
    label: frag.name,
    detail: '同步到所有范本',
    actor: getMockActor(),
  });
}

export let mockBidDocuments: BidDocument[] = [];

export function getMockBidDocuments(): BidDocument[] {
  if (typeof window !== 'undefined') {
    mockBidDocuments = readStorage(STORAGE_KEYS.bidDocuments, mockBidDocuments);
  }
  return deepClone(mockBidDocuments).filter((d) => !d.deletedAt);
}

export function setMockBidDocuments(activeDocs: BidDocument[]) {
  const stored =
    typeof window !== 'undefined'
      ? readStorage(STORAGE_KEYS.bidDocuments, mockBidDocuments)
      : mockBidDocuments;
  mockBidDocuments = mergeActivePreserveDeleted(activeDocs, stored);
  writeStorage(STORAGE_KEYS.bidDocuments, mockBidDocuments);
}

export function softDeleteBidDocument(id: string, actor?: string) {
  const actorResolved = actor ?? getMockActor();
  if (typeof window !== 'undefined') {
    mockBidDocuments = readStorage(STORAGE_KEYS.bidDocuments, mockBidDocuments);
  }
  const now = new Date().toISOString();
  const label = mockBidDocuments.find((d) => d.id === id)?.name;
  mockBidDocuments = mockBidDocuments.map((d) =>
    d.id === id ? { ...d, deletedAt: now, deletedBy: actorResolved } : d,
  );
  writeStorage(STORAGE_KEYS.bidDocuments, mockBidDocuments);
  appendDataAudit({
    scope: 'bid',
    action: 'delete',
    entityId: id,
    label,
    actor: actorResolved,
  });
}
