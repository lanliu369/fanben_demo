import type { Template, TemplateSection } from '@/types';
import { extractFragmentIdsFromHtml } from '@/lib/quotedBlockHtml';

export function sectionContentReferencesFragment(content: string, fragmentId: string): boolean {
  const fid = fragmentId.trim();
  if (!fid || !content.trim()) return false;
  if (
    content.includes(`data-text-fragment-id="${fid}"`) ||
    content.includes(`data-text-fragment-id='${fid}'`)
  ) {
    return true;
  }
  return extractFragmentIdsFromHtml(content).includes(fid);
}

export function sectionReferencesFragment(section: TemplateSection, fragmentId: string): boolean {
  if (section.textFragmentId === fragmentId) return true;
  return sectionContentReferencesFragment(section.content ?? '', fragmentId);
}

export function collectFragmentIdsFromSection(section: TemplateSection): string[] {
  const ids = new Set<string>();
  if (section.textFragmentId?.trim()) {
    ids.add(section.textFragmentId.trim());
  }
  for (const id of extractFragmentIdsFromHtml(section.content ?? '')) {
    ids.add(id);
  }
  return [...ids];
}

export function getSectionTitlesForFragmentInTemplate(
  sections: TemplateSection[],
  textFragmentId: string,
): string[] {
  const out: string[] = [];
  const walk = (secs: TemplateSection[]) => {
    for (const s of secs) {
      if (sectionReferencesFragment(s, textFragmentId)) {
        out.push(s.title.trim() || '(无标题节)');
      }
      if (s.children?.length) {
        walk(s.children);
      }
    }
  };
  walk(sections);
  return out;
}

export function templateReferencesFragment(template: Template, fragmentId: string): boolean {
  return getSectionTitlesForFragmentInTemplate(template.sections, fragmentId).length > 0;
}

/** 保存前：正文内嵌 data-text-fragment-id 时，提升到章节 textFragmentId（单一块时） */
export function promoteEmbeddedFragmentReferences(sections: TemplateSection[]): TemplateSection[] {
  return sections.map((s) => {
    const children = s.children?.length ? promoteEmbeddedFragmentReferences(s.children) : undefined;
    let textFragmentId = s.textFragmentId;
    const content = s.content ?? '';

    if (!textFragmentId && content.includes('data-text-fragment-id')) {
      const embedded = extractFragmentIdsFromHtml(content);
      if (embedded.length === 1) {
        textFragmentId = embedded[0];
      }
    }

    return { ...s, textFragmentId, children };
  });
}
