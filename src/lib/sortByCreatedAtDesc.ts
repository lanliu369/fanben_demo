/**
 * 全系统列表统一按创建时间倒序（新在前）。
 * 无 createdAt 时回退 updatedAt，再回退 id 字符串（含数字）降序，保证新数据靠前。
 */
export type SortableByTime = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

function timeKey(item: SortableByTime): string {
  const c = item.createdAt?.trim();
  if (c) return c;
  const u = item.updatedAt?.trim();
  if (u) return u;
  return '';
}

export function sortByCreatedAtDesc<T extends SortableByTime>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = timeKey(a);
    const kb = timeKey(b);
    if (!ka && !kb) {
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    }
    if (!ka) return 1;
    if (!kb) return -1;
    const t = kb.localeCompare(ka);
    if (t !== 0) return t;
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });
}

