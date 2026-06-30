import type { GeneralTemplateParsedContent, Template, TemplateSection, TextFragment } from '@/types';
import { buildSectionsHtmlWithResources } from '@/lib/resolveTemplateSectionHtml';
import { parseSectionsFromHTML } from '@/lib/parseSectionsFromHTML';
import { wrapGeneralTemplateParagraph } from '@/lib/generalTemplateParagraphHtml';

function buildSectionContent(
  paragraphIds: string[],
  paragraphMap: Map<string, string>,
  generalTemplateId: string,
): string {
  return paragraphIds
    .map((id) => {
      const html = paragraphMap.get(id);
      if (!html?.trim()) return '';
      return wrapGeneralTemplateParagraph(generalTemplateId, id, html);
    })
    .join('');
}

/** 将通用模版解析结果转为范本章节树（段落均带引用关联标记） */
export function buildTemplateSectionsFromGeneralTemplate(
  parsed: GeneralTemplateParsedContent,
  templateId: string,
  generalTemplateId: string,
): TemplateSection[] {
  const paragraphMap = new Map(parsed.paragraphs.map((p) => [p.id, p.html]));

  const walk = (
    outlineSections: GeneralTemplateParsedContent['sections'],
    parentSectionId?: string,
  ): TemplateSection[] =>
    outlineSections.map((outline, index) => {
      const sectionId = `sec-${templateId}-${outline.id}`;
      return {
        id: sectionId,
        templateId,
        chapterId: '',
        title: outline.title,
        order: outline.order ?? index + 1,
        level: outline.level,
        parentId: parentSectionId,
        content: buildSectionContent(outline.paragraphIds, paragraphMap, generalTemplateId),
        children: outline.children?.length ? walk(outline.children, sectionId) : undefined,
      };
    });

  return walk(parsed.sections);
}

/**
 * 新建引用型范本：按通用模版大纲生成章节，并将模版段落与资源占位符拼成可打开的完整章节数据。
 */
export function composeReferencedTemplateFromGeneralTemplate(
  templateId: string,
  lotLevelId: string,
  generalTemplateId: string,
  parsed: GeneralTemplateParsedContent,
  fragments: TextFragment[],
): TemplateSection[] {
  const baseSections = buildTemplateSectionsFromGeneralTemplate(parsed, templateId, generalTemplateId);
  const templateStub: Template = {
    id: templateId,
    name: '',
    frameworkId: 'fw-manual',
    lotLevelId,
    status: 'draft',
    createdAt: '',
    updatedAt: '',
    sections: baseSections,
    variables: [],
    generalTemplateId,
    generalTemplateSyncedVersion: parsed.contentVersion,
  };
  const composedHtml = buildSectionsHtmlWithResources(
    baseSections,
    templateStub,
    fragments,
    0,
    parsed,
  );
  if (!composedHtml.trim()) return baseSections;
  const parsedSections = parseSectionsFromHTML(composedHtml, templateId);
  return parsedSections.length > 0 ? parsedSections : baseSections;
}

export function canonicalParagraphMap(parsed: GeneralTemplateParsedContent): Map<string, string> {
  return new Map(parsed.paragraphs.map((p) => [p.id, p.html]));
}

/** 将解析结果拼成可编辑 HTML（供 WPS 初始化） */
export function buildGeneralTemplateEditHtml(parsed: GeneralTemplateParsedContent): string {
  const paragraphMap = new Map(parsed.paragraphs.map((p) => [p.id, p.html]));

  const walk = (outlineSections: GeneralTemplateParsedContent['sections']): string =>
    outlineSections
      .map((outline) => {
        const level = Math.min(6, Math.max(1, outline.level || 1));
        const heading = outline.title ? `<h${level}>${outline.title}</h${level}>` : '';
        const body = outline.paragraphIds.map((id) => paragraphMap.get(id) ?? '').join('');
        const children = outline.children?.length ? walk(outline.children) : '';
        return `${heading}${body}${children}`;
      })
      .join('');

  return walk(parsed.sections);
}
