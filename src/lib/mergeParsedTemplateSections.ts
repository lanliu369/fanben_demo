import type { TemplateSection } from '@/types';

/**
 * 用「从根到当前节点的标题路径」对齐解析前后的章节，尽量保留 id / chapterId / textFragmentId，
 * 避免金山 WebOffice 保存后资源「范本+小节」绑定失效。同名同路径下多条时仅第一条复用旧 id。
 */
export function mergeParsedSectionsWithPrevious(
  previous: TemplateSection[],
  parsed: TemplateSection[],
): TemplateSection[] {
  const prevMap = new Map<string, TemplateSection>();
  collectPrevByTitlePath(previous, [], prevMap);
  return applyPrevToParsed(parsed, [], prevMap);
}

function segmentKey(title: string): string {
  return title.trim() || '_empty_';
}

function collectPrevByTitlePath(
  nodes: TemplateSection[],
  ancestors: string[],
  map: Map<string, TemplateSection>,
): void {
  for (const s of nodes) {
    const seg = segmentKey(s.title);
    const key = [...ancestors, seg].join('>');
    if (!map.has(key)) {
      map.set(key, s);
    }
    if (s.children?.length) {
      collectPrevByTitlePath(s.children, [...ancestors, seg], map);
    }
  }
}

function applyPrevToParsed(
  nodes: TemplateSection[],
  ancestors: string[],
  map: Map<string, TemplateSection>,
): TemplateSection[] {
  return nodes.map((s) => {
    const seg = segmentKey(s.title);
    const key = [...ancestors, seg].join('>');
    const prev = map.get(key);
    return {
      ...s,
      id: prev?.id ?? s.id,
      templateId: prev?.templateId ?? s.templateId,
      chapterId: prev?.chapterId ?? s.chapterId,
      textFragmentId: prev?.textFragmentId ?? s.textFragmentId,
      children: s.children?.length ? applyPrevToParsed(s.children, [...ancestors, seg], map) : undefined,
    };
  });
}
