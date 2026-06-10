import type { Template, TemplateSection, TextFragment } from '@/types';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { bindingMatchesSection } from '@/lib/textBindingMatch';
import { expandNestedResourceEmbeds } from '@/lib/resourceEmbedHtml';

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

/**
 * 保存范本章节树时：凡资源驱动的章节，正文强制与资源管理当前稿一致（范本编制页内修改不落地）。
 */
export function applyCanonicalResourceBodiesToSections(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
): TemplateSection[] {
  return sections.map((s) => {
    const children = s.children?.length
      ? applyCanonicalResourceBodiesToSections(s.children, template, fragments)
      : undefined;
    if (!sectionBodyIsFromResource(s, template, fragments)) {
      return { ...s, children };
    }
    const canonical = resolveSectionRichHtml(s, template, fragments);
    return { ...s, content: canonical, children };
  });
}

export function buildSectionsHtmlWithResources(
  sections: TemplateSection[],
  template: Template,
  fragments: TextFragment[],
  depth = 0,
): string {
  return sections
    .map((section) => {
      const body = resolveSectionRichHtml(section, template, fragments);
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
