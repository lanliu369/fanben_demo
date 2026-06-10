import type { DataAuditAction, DataAuditEntry, DataAuditScope } from '@/types';

const STORAGE_KEY = 'oo-data-audit-log';
const MAX_ENTRIES = 500;

export function getMockActor(): string {
  if (typeof window === 'undefined') return '演示用户';
  try {
    const v = window.localStorage.getItem('oo-mock-actor')?.trim();
    return v || '演示用户';
  } catch {
    return '演示用户';
  }
}

/** 前端演示：设置当前操作者姓名（写入 localStorage `oo-mock-actor`），用于审计「删除人」等 */
export function setMockActorLabel(label: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('oo-mock-actor', label.trim() || '演示用户');
  } catch {
    /* ignore */
  }
}

export function appendDataAudit(
  partial: Omit<DataAuditEntry, 'id' | 'at'> & { actor?: string },
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prev: DataAuditEntry[] = raw ? (JSON.parse(raw) as DataAuditEntry[]) : [];
    const entry: DataAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      actor: partial.actor ?? getMockActor(),
      scope: partial.scope,
      action: partial.action,
      entityId: partial.entityId,
      label: partial.label,
      detail: partial.detail,
    };
    const next = [entry, ...prev].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getDataAuditLog(): DataAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DataAuditEntry[];
  } catch {
    return [];
  }
}

function sortAuditDesc(entries: DataAuditEntry[]): DataAuditEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}

/** 招采分类管理操作日志 */
export function getCategoryAuditLogs(): DataAuditEntry[] {
  return sortAuditDesc(getDataAuditLog().filter((e) => e.scope === 'category'));
}

/** @deprecated */
export function getCategorySyncAuditLogs(): DataAuditEntry[] {
  return getCategoryAuditLogs();
}

/** 指定范本 ID 相关审计（新建/更新/发布/删除等） */
export function getTemplateAuditLogs(templateId: string): DataAuditEntry[] {
  return sortAuditDesc(getDataAuditLog().filter((e) => e.scope === 'template' && e.entityId === templateId));
}

/** 指定文本资源 ID 相关审计 */
export function getTextAuditLogs(textId: string): DataAuditEntry[] {
  return sortAuditDesc(getDataAuditLog().filter((e) => e.scope === 'text' && e.entityId === textId));
}

export function formatAuditAction(action: DataAuditAction): string {
  const map: Record<DataAuditAction, string> = {
    create: '新建',
    update: '更新',
    delete: '删除',
    sync: '同步',
    import: '批量导入',
    export: '导出',
    activate: '启用',
    deactivate: '停用',
  };
  return map[action] ?? action;
}

export function formatAuditAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
