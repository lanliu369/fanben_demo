export type HighlightSegment = { text: string; match: boolean };

/** 按关键词拆分文本，用于列表搜索高亮（大小写不敏感） */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: HighlightSegment[] = [];
  let start = 0;
  let idx = lower.indexOf(qLower, start);
  while (idx !== -1) {
    if (idx > start) parts.push({ text: text.slice(start, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    start = idx + q.length;
    idx = lower.indexOf(qLower, start);
  }
  if (start < text.length) parts.push({ text: text.slice(start), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

export function lotMatchesSearchQuery(
  lot: { name: string; code: string },
  pathText: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (lot.name.toLowerCase().includes(q)) return true;
  if (pathText?.toLowerCase().includes(q)) return true;
  return false;
}
