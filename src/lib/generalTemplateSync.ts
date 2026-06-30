import type { GeneralTemplateParsedContent, Template, TemplateSection } from '@/types';
import { canonicalParagraphMap } from '@/lib/generalTemplateApply';
import {
  detachEditedGeneralTemplateBlocksInHtml,
  extractGeneralTemplateParagraphIdsFromHtml,
  reconcileExportedGeneralTemplateBlocksInHtml,
  stripGeneralTemplateMarkerAndChromeFromHtml,
  syncGeneralTemplateBlocksInHtml,
} from '@/lib/generalTemplateParagraphHtml';

function sectionKey(title: string): string {
  return title.trim() || '_empty_';
}

function buildPreviousSectionMap(
  nodes: TemplateSection[],
  ancestors: string[] = [],
  map = new Map<string, TemplateSection>(),
): Map<string, TemplateSection> {
  for (const s of nodes) {
    const seg = sectionKey(s.title);
    const key = [...ancestors, seg].join('>');
    if (!map.has(key)) {
      map.set(key, s);
    }
    if (s.children?.length) {
      buildPreviousSectionMap(s.children, [...ancestors, seg], map);
    }
  }
  return map;
}

/** 保存前：模版引用段落若已被手动修改，则解除关联（资源插入块不受影响） */
export function detachManuallyEditedGeneralTemplateSections(
  sections: TemplateSection[],
  generalTemplateId: string,
  parsed: GeneralTemplateParsedContent,
  previousSections: TemplateSection[] = [],
  ancestors: string[] = [],
): TemplateSection[] {
  const canonicalMap = canonicalParagraphMap(parsed);
  const prevMap = buildPreviousSectionMap(previousSections);

  return sections.map((s) => {
    const seg = sectionKey(s.title);
    const key = [...ancestors, seg].join('>');
    const prev = prevMap.get(key);
    const children = s.children?.length
      ? detachManuallyEditedGeneralTemplateSections(
          s.children,
          generalTemplateId,
          parsed,
          previousSections,
          [...ancestors, seg],
        )
      : undefined;

    let content = reconcileExportedGeneralTemplateBlocksInHtml(
      s.content ?? '',
      prev?.content ?? '',
      generalTemplateId,
      canonicalMap,
    );
    content = detachEditedGeneralTemplateBlocksInHtml(content, canonicalMap);

    return { ...s, content, children };
  });
}

/** 保存时：刷新仍关联且未改动的模版段落 */
export function syncUnchangedLinkedGeneralTemplateOnSave(
  sections: TemplateSection[],
  generalTemplateId: string,
  parsed: GeneralTemplateParsedContent,
): TemplateSection[] {
  const canonicalMap = canonicalParagraphMap(parsed);

  return sections.map((s) => {
    let content = s.content ?? '';
    for (const [pid, canonical] of canonicalMap) {
      if (content.includes(`data-general-template-paragraph-id="${pid}"`)) {
        content = syncGeneralTemplateBlocksInHtml(content, generalTemplateId, pid, canonical);
      }
    }
    const children = s.children?.length
      ? syncUnchangedLinkedGeneralTemplateOnSave(s.children, generalTemplateId, parsed)
      : undefined;
    return { ...s, content, children };
  });
}

/** 模版更新后：将仍有关联标记的段落同步到范本 */
export function syncGeneralTemplateParagraphsInSections(
  sections: TemplateSection[],
  generalTemplateId: string,
  parsed: GeneralTemplateParsedContent,
): TemplateSection[] {
  return syncUnchangedLinkedGeneralTemplateOnSave(sections, generalTemplateId, parsed);
}

export function collectLinkedGeneralTemplateParagraphIds(sections: TemplateSection[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: TemplateSection[]) => {
    for (const s of nodes) {
      for (const pid of extractGeneralTemplateParagraphIdsFromHtml(s.content ?? '')) {
        ids.add(pid);
      }
      if (s.children?.length) walk(s.children);
    }
  };
  walk(sections);
  return ids;
}

/** 保存后若仍有模版段落关联被取消，视为范本已改为自定义 */
export function generalTemplateAssociationBroken(
  previousSections: TemplateSection[],
  mergedSections: TemplateSection[],
): boolean {
  const prev = collectLinkedGeneralTemplateParagraphIds(previousSections);
  const next = collectLinkedGeneralTemplateParagraphIds(mergedSections);
  if (prev.size === 0) return false;
  if (next.size < prev.size) return true;
  for (const id of prev) {
    if (!next.has(id)) return true;
  }
  return false;
}

export function stripGeneralTemplateLinksFromSections(sections: TemplateSection[]): TemplateSection[] {
  return sections.map((s) => ({
    ...s,
    content: stripGeneralTemplateMarkerAndChromeFromHtml(s.content ?? ''),
    children: s.children?.length ? stripGeneralTemplateLinksFromSections(s.children) : undefined,
  }));
}

/** 手动修改模版段落后：解除范本与通用模版关联，并去掉正文内全部模版引用标记 */
export function applyGeneralTemplateDetachOnSave(
  template: Template,
  previousSections: TemplateSection[],
  mergedSections: TemplateSection[],
): Pick<Template, 'sections' | 'generalTemplateId' | 'generalTemplateSyncedVersion'> {
  const gtId = template.generalTemplateId?.trim();
  if (!gtId) {
    return { sections: mergedSections };
  }
  if (!generalTemplateAssociationBroken(previousSections, mergedSections)) {
    return {
      sections: mergedSections,
      generalTemplateId: gtId,
      generalTemplateSyncedVersion: template.generalTemplateSyncedVersion,
    };
  }
  return {
    sections: stripGeneralTemplateLinksFromSections(mergedSections),
    generalTemplateId: undefined,
    generalTemplateSyncedVersion: undefined,
  };
}

export function templateReferencesGeneralTemplate(template: Template): boolean {
  return Boolean(template.generalTemplateId?.trim());
}

export function collectTemplateIdsUsingGeneralTemplate(generalTemplateId: string, templates: Template[]): string[] {
  const gtId = generalTemplateId.trim();
  if (!gtId) return [];
  return templates.filter((t) => !t.deletedAt && t.generalTemplateId === gtId).map((t) => t.id);
}
