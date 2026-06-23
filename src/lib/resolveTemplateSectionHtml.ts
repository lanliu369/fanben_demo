import type { Template, TemplateSection, TextFragment } from '@/types';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { bindingMatchesSection } from '@/lib/textBindingMatch';
import { expandNestedResourceEmbeds } from '@/lib/resourceEmbedHtml';
import {
  normalizeComparablePlainText,
  reconcileExportedResourceBlocksInHtml,
  stripResourceInsertChrome,
  stripResourceMarkerAndChromeFromHtml,
  syncResourceBlocksInHtml,
  wrapQuotedResourceBlock,
} from '@/lib/quotedBlockHtml';

/**
 * 解析范本章节正文：优先使用资源管理中当前保存的富文本 HTML（含字体、字号、行高等内联样式），
 * 再回落到章节自身 content。
 *
 * 匹配规则：
 * 1. `section.textFragmentId` 显式引用 → 使用该文本片段当前保存的正文。
 * 2. 无显式引用时：若某资源的绑定命中本范本章节 → 使用该资源正文。
 *    - 新版：`templateId` + `templateSectionId`（与范本、章节节点一致）
 *    - 兼容旧版：`frameworkId` + `chapterId`（与范本 frameworkId、章节 chapterId 一致）
 *
 * 正文中若含「资源嵌入」占位，再按范本标段展开为被引用资源的正文。
 */
export function resolveSectionRichHtml(
  section: TemplateSection,
  template: Template,
  fragments: TextFragment[],
): string {
  const pickFragmentHtml = (frag: TextFragment): string => frag.content ?? '';

  let body = '';

  if (section.textFragmentId) {
    const frag = fragments.find((f) => f.id === section.textFragmentId);
    if (frag) {
      const html = pickFragmentHtml(frag);
      body = html.trim() ? html : (section.content ?? '');
    } else {
      body = section.content ?? '';
    }
  } else {
    const bindings = fragments.flatMap((frag) =>
      (frag.bindings ?? []).map((b) => ({ binding: b, fragment: frag })),
    );
    const hit = bindings.find((x) => bindingMatchesSection(x.binding, template, section));
    if (hit) {
      const html = pickFragmentHtml(hit.fragment);
      body = html.trim() ? html : (section.content ?? '');
    } else {
      body = section.content ?? '';
    }
  }

  return expandNestedResourceEmbeds(body, resolveTemplateLotLevelId(template), fragments);
}

/** 章节正文是否由资源库驱动（显式引用或非空绑定命中），与 resolveSectionRichHtml 判定一致 */
export function sectionBodyIsFromResource(
  section: TemplateSection,
  template: Template,
  fragments: TextFragment[],
): boolean {
  if (section.textFragmentId) {
    const frag = fragments.find((f) => f.id === section.textFragmentId);
    return Boolean(frag && (frag.content ?? '').trim());
  }
  const bindings = fragments.flatMap((frag) =>
    (frag.bindings ?? []).map((b) => ({ binding: b, fragment: frag })),
  );
  const hit = bindings.find((x) => bindingMatchesSection(x.binding, template, section));
  return Boolean(hit && (hit.fragment.content ?? '').trim());
}

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

/**
 * 保存前：正文内引用块若已被手动修改，则去掉 data-text-fragment-id 与高亮；整章资源引用若正文已偏离资源稿则解除章节级关联。
 */
export function detachManuallyEditedResourceSections(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
  previousSections: TemplateSection[] = [],
  ancestors: string[] = [],
): TemplateSection[] {
  const canonicalMap = canonicalByFragmentId(template, fragments);
  const prevMap = buildPreviousSectionMap(previousSections);
  return sections.map((s) => {
    const seg = sectionKey(s.title);
    const key = [...ancestors, seg].join('>');
    const prev = prevMap.get(key);
    const children = s.children?.length
      ? detachManuallyEditedResourceSections(s.children, template, fragments, previousSections, [...ancestors, seg])
      : undefined;

    let content = reconcileExportedResourceBlocksInHtml(
      s.content ?? '',
      prev?.content ?? '',
      canonicalMap,
    );

    let textFragmentId = s.textFragmentId;
    if (textFragmentId && sectionBodyIsFromResource({ ...s, textFragmentId, content }, template, fragments)) {
      const canonical = canonicalMap.get(textFragmentId) ?? '';
      const local = stripResourceInsertChrome(content);
      if (contentDiffersFromCanonicalSection(local, canonical)) {
        textFragmentId = undefined;
        content = stripResourceMarkerAndChromeFromHtml(content);
      }
    }

    return { ...s, content, textFragmentId, children };
  });
}

function contentDiffersFromCanonicalSection(localHtml: string, canonical: string): boolean {
  const localPlain = normalizeComparablePlainText(localHtml);
  const canonPlain = normalizeComparablePlainText(canonical);
  if (!localPlain && !canonPlain) return false;
  if (!canonPlain) return Boolean(localPlain);
  return localPlain !== canonPlain;
}

/**
 * 保存时：仅刷新仍关联且未手动改动的引用块/整章资源；已脱离块保留用户正文。
 */
export function syncUnchangedLinkedResourcesOnSave(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
): TemplateSection[] {
  const canonicalMap = canonicalByFragmentId(template, fragments);
  return sections.map((s) => {
    const children = s.children?.length
      ? syncUnchangedLinkedResourcesOnSave(s.children, template, fragments)
      : undefined;

    let content = s.content ?? '';

    for (const [fid, canonical] of canonicalMap) {
      if (
        content.includes(`data-text-fragment-id="${fid}"`) ||
        content.includes(`data-text-fragment-id='${fid}'`)
      ) {
        content = syncResourceBlocksInHtml(content, fid, canonical);
      }
    }

    if (s.textFragmentId && sectionBodyIsFromResource({ ...s, content }, template, fragments)) {
      const fid = s.textFragmentId;
      const canonical = canonicalMap.get(fid) ?? '';
      const local = stripResourceInsertChrome(content);
      if (!contentDiffersFromCanonicalSection(local, canonical)) {
        content = wrapQuotedResourceBlock(fid, canonical);
      }
    }

    return { ...s, content, children };
  });
}

/** @deprecated 使用 syncUnchangedLinkedResourcesOnSave */
export function applyCanonicalResourceBodiesToSections(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
): TemplateSection[] {
  return syncUnchangedLinkedResourcesOnSave(sections, template, fragments);
}

function canonicalByFragmentId(template: Template, fragments: TextFragment[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const frag of fragments) {
    if (frag.deletedAt) continue;
    const html = expandNestedResourceEmbeds(
      frag.content ?? '',
      resolveTemplateLotLevelId(template),
      fragments,
    );
    map.set(frag.id, html);
  }
  return map;
}

export function buildSectionsHtmlWithResources(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
  depth = 0,
): string {
  const canonicalMap = canonicalByFragmentId(template, fragments);
  return sections
    .map((section) => {
      const stored = (section.content ?? '').trim();
      let body: string;

      if (
        section.textFragmentId &&
        sectionBodyIsFromResource(section, template, fragments) &&
        !stored.includes('data-text-fragment-id')
      ) {
        body = wrapQuotedResourceBlock(
          section.textFragmentId,
          resolveSectionRichHtml(section, template, fragments),
        );
      } else if (stored) {
        body = stored;
        for (const [fid, canonical] of canonicalMap) {
          if (body.includes(`data-text-fragment-id="${fid}"`) || body.includes(`data-text-fragment-id='${fid}'`)) {
            body = syncResourceBlocksInHtml(body, fid, canonical);
          }
        }
      } else {
        body = resolveSectionRichHtml(section, template, fragments);
        if (section.textFragmentId && sectionBodyIsFromResource(section, template, fragments)) {
          body = wrapQuotedResourceBlock(section.textFragmentId, body);
        }
      }

      const childrenHtml = section.children?.length
        ? buildSectionsHtmlWithResources(section.children, template, fragments, depth + 1)
        : '';

      if (!section.title.trim()) {
        return `${body}${childrenHtml}`;
      }

      const headingLevel = Math.min(Math.max(depth + 1, 1), 6);
      return `<h${headingLevel}>${section.title}</h${headingLevel}>${body}${childrenHtml}`;
    })
    .join('');
}
