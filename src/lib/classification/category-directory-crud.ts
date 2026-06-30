/**
 * 招采分类页目录节点增删改（仅 CategoryPage 使用，不改变其它业务页逻辑）
 */
import type {
  BusinessSector,
  BusinessType,
  ClassificationStore,
  DomainLevel,
} from '@/types';
import type { EvaluationMethod, ProcurementMethod } from './constants';
import { buildBusinessTypeDisplayName } from './code';
import { createLotLevel, type LotFormInput } from './crud';
import { getClassificationStore, setClassificationStore } from './storage';
import {
  allowsDirectoryTreeDescription,
  isUnassignedDomainNodeKey,
  type DirectoryLevel,
  type DirectoryNodeKind,
  type DirectoryTreeNode,
} from './category-directory-tree';

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString().slice(0, 10);
}

function clampSortOrder(n: number): number {
  if (!Number.isFinite(n)) return 99;
  return Math.min(99, Math.max(1, Math.round(n)));
}

export type DirectoryFormInput = {
  name: string;
  /** 未传时新增默认 99，编辑保留原值 */
  sortOrder?: number;
  description?: string;
  /** 品类级别（L6）专用 */
  procurementMethods?: ProcurementMethod[];
  evaluationMethod?: EvaluationMethod;
};

function validateLotDirectoryFields(input: DirectoryFormInput): string | null {
  if (!input.procurementMethods?.length) return '请至少选择一种采购方式';
  if (!input.evaluationMethod) return '请选择评审办法';
  return null;
}

export type DirectoryFormContext = {
  mode: 'add' | 'edit';
  level: DirectoryLevel;
  parentKind?: DirectoryNodeKind;
  node?: DirectoryTreeNode;
};

function sectorCodeFromName(name: string): string {
  const map: Record<string, string> = {
    新能源发电: 'XNY',
    传统能源: 'HD',
    通用: 'TY',
    风电: 'FD',
  };
  return map[name.trim()] ?? (name.trim().slice(0, 4).toUpperCase() || 'BS');
}

export function saveDirectoryNode(
  ctx: DirectoryFormContext,
  input: DirectoryFormInput,
): { ok: true; nodeKey: string } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: '请填写目录名称' };
  const sortOrder =
    ctx.mode === 'edit' && ctx.node
      ? ctx.node.sortOrder
      : clampSortOrder(input.sortOrder ?? 99);
  const canTreeDesc = allowsDirectoryTreeDescription(ctx.level);
  const desc = canTreeDesc ? input.description?.trim() : undefined;
  const store = getClassificationStore();
  const now = isoNow();

  if (ctx.level === 6) {
    const lotValidation = validateLotDirectoryFields(input);
    if (lotValidation) return { ok: false, error: lotValidation };
  }

  if (ctx.mode === 'add') {
    if (ctx.level === 6) {
      if (!ctx.node) return { ok: false, error: '请先选择上级目录' };
      return createLotUnderDirectoryParent(ctx.node, name, sortOrder, input);
    }
    return createDirectoryNode(store, ctx, name, sortOrder, desc, now);
  }
  return updateDirectoryNode(store, ctx, input, now);
}

function createLotUnderDirectoryParent(
  parent: DirectoryTreeNode,
  lotName: string,
  sortOrder: number,
  input: DirectoryFormInput,
): { ok: true; nodeKey: string } | { ok: false; error: string } {
  if (!parent.businessTypeId || !parent.sectorId) {
    return { ok: false, error: '请先选择上级目录' };
  }
  const store = getClassificationStore();
  const bt = store.businessTypes.find((b) => b.id === parent.businessTypeId);
  if (!bt) return { ok: false, error: '上级目录不存在' };

  const lotInput: LotFormInput = {
    businessSectorId: parent.sectorId,
    energyType: bt.energyType,
    businessStage: bt.businessStage,
    businessNature: bt.businessNature,
    domainLevelId: isUnassignedDomainNodeKey(parent.key) ? undefined : parent.domainId,
    lotName,
    procurementMethods: [...(input.procurementMethods ?? [])],
    evaluationMethods: [input.evaluationMethod!],
  };

  const result = createLotLevel(lotInput);
  if (result.error) return { ok: false, error: result.error };

  const next = getClassificationStore();
  const idx = next.lotLevels.findIndex((l) => l.id === result.lot.id);
  if (idx >= 0) {
    next.lotLevels[idx] = {
      ...next.lotLevels[idx],
      sortOrder: clampSortOrder(sortOrder),
      updatedAt: isoNow(),
    };
    setClassificationStore(next);
  }
  return { ok: true, nodeKey: `l:${result.lot.id}` };
}

function createDirectoryNode(
  store: ClassificationStore,
  ctx: DirectoryFormContext,
  name: string,
  sortOrder: number,
  desc: string | undefined,
  now: string,
): { ok: true; nodeKey: string } | { ok: false; error: string } {
  const parent = ctx.node;

  if (ctx.level === 1) {
    if (store.businessSectors.some((s) => s.name === name)) {
      return { ok: false, error: '业务板块名称已存在' };
    }
    const created: BusinessSector = {
      id: uid('bs'),
      code: sectorCodeFromName(name),
      name,
      sortOrder,
      description: desc,
      createdAt: now,
      updatedAt: now,
    };
    store.businessSectors.push(created);
    setClassificationStore(store);
    return { ok: true, nodeKey: `s:${created.id}` };
  }

  if (!parent?.sectorId) return { ok: false, error: '请先选择上级目录' };

  if (ctx.level === 2) {
    if (
      store.businessTypes.some(
        (bt) => bt.businessSectorId === parent.sectorId && bt.energyType === name,
      )
    ) {
      return { ok: false, error: '该能源类型已存在' };
    }
    const bt: BusinessType = {
      id: uid('bt'),
      businessSectorId: parent.sectorId,
      energyType: name,
      businessStage: '待配置',
      businessNature: '待配置',
      displayName: buildBusinessTypeDisplayName(name, '待配置', '待配置'),
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    store.businessTypes.push(bt);
    setClassificationStore(store);
    return { ok: true, nodeKey: `e:${parent.sectorId}:${name}` };
  }

  if (ctx.level === 3 && parent.energyType) {
    if (
      store.businessTypes.some(
        (bt) =>
          bt.businessSectorId === parent.sectorId &&
          bt.energyType === parent.energyType &&
          bt.businessStage === name,
      )
    ) {
      return { ok: false, error: '该业务阶段已存在' };
    }
    const bt: BusinessType = {
      id: uid('bt'),
      businessSectorId: parent.sectorId,
      energyType: parent.energyType,
      businessStage: name,
      businessNature: '待配置',
      displayName: buildBusinessTypeDisplayName(parent.energyType, name, '待配置'),
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    store.businessTypes.push(bt);
    setClassificationStore(store);
    return { ok: true, nodeKey: `st:${parent.sectorId}:${parent.energyType}:${name}` };
  }

  if (ctx.level === 4 && parent.energyType && parent.businessStage) {
    if (
      store.businessTypes.some(
        (bt) =>
          bt.businessSectorId === parent.sectorId &&
          bt.energyType === parent.energyType &&
          bt.businessStage === parent.businessStage &&
          bt.businessNature === name,
      )
    ) {
      return { ok: false, error: '该业务性质已存在' };
    }
    const bt: BusinessType = {
      id: uid('bt'),
      businessSectorId: parent.sectorId,
      energyType: parent.energyType,
      businessStage: parent.businessStage,
      businessNature: name,
      displayName: buildBusinessTypeDisplayName(parent.energyType, parent.businessStage, name),
      sortOrder,
      description: desc,
      createdAt: now,
      updatedAt: now,
    };
    store.businessTypes.push(bt);
    setClassificationStore(store);
    return { ok: true, nodeKey: `bt:${bt.id}` };
  }

  if (ctx.level === 5 && parent.businessTypeId) {
    if (
      store.domainLevels.some((d) => d.businessTypeId === parent.businessTypeId && d.name === name)
    ) {
      return { ok: false, error: '该系统/专业/阶段已存在' };
    }
    const dl: DomainLevel = {
      id: uid('dl'),
      name,
      businessTypeId: parent.businessTypeId,
      sortOrder,
      description: desc,
      createdAt: now,
      updatedAt: now,
    };
    store.domainLevels.push(dl);
    setClassificationStore(store);
    return { ok: true, nodeKey: `d:${dl.id}` };
  }

  return { ok: false, error: '无法在该层级下新增' };
}

function updateDirectoryNode(
  store: ClassificationStore,
  ctx: DirectoryFormContext,
  input: DirectoryFormInput,
  now: string,
): { ok: true; nodeKey: string } | { ok: false; error: string } {
  const node = ctx.node;
  if (!node) return { ok: false, error: '节点不存在' };
  const name = input.name.trim();
  const sortOrder = clampSortOrder(input.sortOrder ?? node.sortOrder);
  const canTreeDesc = allowsDirectoryTreeDescription(ctx.level);
  const desc = canTreeDesc ? input.description?.trim() : undefined;

  if (node.kind === 'sector' && node.sectorId) {
    const idx = store.businessSectors.findIndex((s) => s.id === node.sectorId);
    if (idx < 0) return { ok: false, error: '节点不存在' };
    if (store.businessSectors.some((s) => s.id !== node.sectorId && s.name === name)) {
      return { ok: false, error: '业务板块名称已存在' };
    }
    store.businessSectors[idx] = {
      ...store.businessSectors[idx],
      name,
      sortOrder,
      ...(canTreeDesc ? { description: desc } : {}),
      updatedAt: now,
    };
    setClassificationStore(store);
    return { ok: true, nodeKey: node.key };
  }

  if (node.kind === 'energy' && node.sectorId && node.energyType) {
    const affected = store.businessTypes.filter(
      (bt) => bt.businessSectorId === node.sectorId && bt.energyType === node.energyType,
    );
    if (
      store.businessTypes.some(
        (bt) =>
          bt.businessSectorId === node.sectorId &&
          bt.energyType === name &&
          bt.energyType !== node.energyType,
      )
    ) {
      return { ok: false, error: '该能源类型已存在' };
    }
    for (const bt of affected) {
      bt.energyType = name;
      bt.displayName = buildBusinessTypeDisplayName(name, bt.businessStage, bt.businessNature);
      bt.sortOrder = sortOrder;
      bt.updatedAt = now;
    }
    setClassificationStore(store);
    return { ok: true, nodeKey: `e:${node.sectorId}:${name}` };
  }

  if (node.kind === 'stage' && node.sectorId && node.energyType && node.businessStage) {
    const affected = store.businessTypes.filter(
      (bt) =>
        bt.businessSectorId === node.sectorId &&
        bt.energyType === node.energyType &&
        bt.businessStage === node.businessStage,
    );
    if (
      store.businessTypes.some(
        (bt) =>
          bt.businessSectorId === node.sectorId &&
          bt.energyType === node.energyType &&
          bt.businessStage === name &&
          bt.businessStage !== node.businessStage,
      )
    ) {
      return { ok: false, error: '该业务阶段已存在' };
    }
    for (const bt of affected) {
      bt.businessStage = name;
      bt.displayName = buildBusinessTypeDisplayName(bt.energyType, name, bt.businessNature);
      bt.sortOrder = sortOrder;
      bt.updatedAt = now;
    }
    setClassificationStore(store);
    return { ok: true, nodeKey: `st:${node.sectorId}:${node.energyType}:${name}` };
  }

  if (node.kind === 'businessType' && node.businessTypeId) {
    const idx = store.businessTypes.findIndex((b) => b.id === node.businessTypeId);
    if (idx < 0) return { ok: false, error: '节点不存在' };
    const bt = store.businessTypes[idx];
    if (
      store.businessTypes.some(
        (b) =>
          b.id !== bt.id &&
          b.businessSectorId === bt.businessSectorId &&
          b.energyType === bt.energyType &&
          b.businessStage === bt.businessStage &&
          b.businessNature === name,
      )
    ) {
      return { ok: false, error: '该业务性质已存在' };
    }
    store.businessTypes[idx] = {
      ...bt,
      businessNature: name,
      displayName: buildBusinessTypeDisplayName(bt.energyType, bt.businessStage, name),
      sortOrder,
      ...(canTreeDesc ? { description: desc } : {}),
      updatedAt: now,
    };
    setClassificationStore(store);
    return { ok: true, nodeKey: node.key };
  }

  if (node.kind === 'domain' && isUnassignedDomainNodeKey(node.key) && node.businessTypeId) {
    const idx = store.businessTypes.findIndex((b) => b.id === node.businessTypeId);
    if (idx < 0) return { ok: false, error: '节点不存在' };
    store.businessTypes[idx] = {
      ...store.businessTypes[idx],
      ...(canTreeDesc ? { unassignedDomainDescription: desc } : {}),
      updatedAt: now,
    };
    setClassificationStore(store);
    return { ok: true, nodeKey: node.key };
  }

  if (node.kind === 'domain' && node.domainId) {
    const idx = store.domainLevels.findIndex((d) => d.id === node.domainId);
    if (idx < 0) return { ok: false, error: '节点不存在' };
    const dl = store.domainLevels[idx];
    if (
      store.domainLevels.some(
        (d) => d.id !== dl.id && d.businessTypeId === dl.businessTypeId && d.name === name,
      )
    ) {
      return { ok: false, error: '该系统/专业/阶段已存在' };
    }
    store.domainLevels[idx] = {
      ...dl,
      name,
      sortOrder,
      ...(canTreeDesc ? { description: desc } : {}),
      updatedAt: now,
    };
    setClassificationStore(store);
    return { ok: true, nodeKey: node.key };
  }

  if (node.kind === 'lot' && node.lotId) {
    const idx = store.lotLevels.findIndex((l) => l.id === node.lotId);
    if (idx < 0) return { ok: false, error: '节点不存在' };
    store.lotLevels[idx] = {
      ...store.lotLevels[idx],
      name,
      sortOrder,
      procurementMethods: [...(input.procurementMethods ?? [])],
      evaluationMethods: input.evaluationMethod ? [input.evaluationMethod] : [],
      updatedAt: now,
    };
    setClassificationStore(store);
    return { ok: true, nodeKey: node.key };
  }

  return { ok: false, error: '不支持编辑该节点' };
}

export function deleteDirectoryNode(node: DirectoryTreeNode): { ok: boolean; error?: string } {
  if (node.kind === 'lot') {
    return { ok: false, error: '请使用品类删除或编辑完整表单' };
  }
  if (!window.confirm(`确定删除「${node.name}」及其下级数据？`)) {
    return { ok: false };
  }

  const store = getClassificationStore();

  if (node.kind === 'sector' && node.sectorId) {
    const sectorId = node.sectorId;
    const btIds = new Set(
      store.businessTypes.filter((b) => b.businessSectorId === sectorId).map((b) => b.id),
    );
    setClassificationStore({
      businessSectors: store.businessSectors.filter((s) => s.id !== sectorId),
      businessTypes: store.businessTypes.filter((b) => b.businessSectorId !== sectorId),
      domainLevels: store.domainLevels.filter((d) => !btIds.has(d.businessTypeId)),
      lotLevels: store.lotLevels.filter((l) => l.businessSectorId !== sectorId),
    });
    return { ok: true };
  }

  if (node.kind === 'energy' && node.sectorId && node.energyType) {
    const btIds = new Set(
      store.businessTypes
        .filter((b) => b.businessSectorId === node.sectorId && b.energyType === node.energyType)
        .map((b) => b.id),
    );
    setClassificationStore({
      ...store,
      businessTypes: store.businessTypes.filter((b) => !btIds.has(b.id)),
      domainLevels: store.domainLevels.filter((d) => !btIds.has(d.businessTypeId)),
      lotLevels: store.lotLevels.filter((l) => !btIds.has(l.businessTypeId)),
    });
    return { ok: true };
  }

  if (node.kind === 'stage' && node.sectorId && node.energyType && node.businessStage) {
    const btIds = new Set(
      store.businessTypes
        .filter(
          (b) =>
            b.businessSectorId === node.sectorId &&
            b.energyType === node.energyType &&
            b.businessStage === node.businessStage,
        )
        .map((b) => b.id),
    );
    setClassificationStore({
      ...store,
      businessTypes: store.businessTypes.filter((b) => !btIds.has(b.id)),
      domainLevels: store.domainLevels.filter((d) => !btIds.has(d.businessTypeId)),
      lotLevels: store.lotLevels.filter((l) => !btIds.has(l.businessTypeId)),
    });
    return { ok: true };
  }

  if (node.kind === 'businessType' && node.businessTypeId) {
    const btId = node.businessTypeId;
    setClassificationStore({
      ...store,
      businessTypes: store.businessTypes.filter((b) => b.id !== btId),
      domainLevels: store.domainLevels.filter((d) => d.businessTypeId !== btId),
      lotLevels: store.lotLevels.filter((l) => l.businessTypeId !== btId),
    });
    return { ok: true };
  }

  if (node.kind === 'domain' && isUnassignedDomainNodeKey(node.key)) {
    return { ok: false, error: '系统占位节点不可删除，请删除其下品类' };
  }

  if (node.kind === 'domain' && node.domainId) {
    const domainId = node.domainId;
    setClassificationStore({
      ...store,
      domainLevels: store.domainLevels.filter((d) => d.id !== domainId),
      lotLevels: store.lotLevels.filter((l) => l.domainLevelId !== domainId),
    });
    return { ok: true };
  }

  return { ok: false, error: '无法删除该节点' };
}
