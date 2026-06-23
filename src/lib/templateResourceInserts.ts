const KEY = 'oo-template-resource-inserts';

function readMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/** 记录范本编辑器侧栏插入的资源（mammoth 导出会丢 data-text-fragment-id，靠此兜底） */
export function recordTemplateResourceInsert(templateId: string, fragmentId: string): void {
  const tid = templateId.trim();
  const fid = fragmentId.trim();
  if (!tid || !fid) return;
  const map = readMap();
  const prev = map[tid] ?? [];
  if (!prev.includes(fid)) {
    map[tid] = [...prev, fid];
    writeMap(map);
  }
}

export function getTemplateResourceInserts(templateId: string): string[] {
  const tid = templateId.trim();
  if (!tid) return [];
  return readMap()[tid] ?? [];
}

export function clearTemplateResourceInserts(templateId: string): void {
  const tid = templateId.trim();
  if (!tid) return;
  const map = readMap();
  if (!map[tid]) return;
  delete map[tid];
  writeMap(map);
}
