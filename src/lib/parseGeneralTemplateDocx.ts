import type { TemplateSection } from '@/types';
import type { GeneralTemplateOutlineSection, GeneralTemplateParagraph, GeneralTemplateParsedContent } from '@/types';
import { docxToHtml } from '@/lib/docxImport/docxToHtml';
import { parseSectionsFromHTML } from '@/lib/parseSectionsFromHTML';

function splitSectionContentIntoBlocks(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  if (typeof DOMParser === 'undefined') {
    return [trimmed];
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${trimmed}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return [trimmed];

  const blocks: string[] = [];
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push((node as HTMLElement).outerHTML);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      blocks.push(`<p>${node.textContent.trim()}</p>`);
    }
  });
  return blocks.length > 0 ? blocks : [trimmed];
}

function nextParagraphId(sectionIndex: string, blockIndex: number): string {
  return `gtp-${sectionIndex}-${blockIndex}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapSectionsToOutline(
  sections: TemplateSection[],
  paragraphs: GeneralTemplateParagraph[],
  pathPrefix = '0',
): GeneralTemplateOutlineSection[] {
  return sections.map((section, index) => {
    const sectionKey = `${pathPrefix}-${index}`;
    const paragraphIds: string[] = [];
    const blocks = splitSectionContentIntoBlocks(section.content ?? '');
    blocks.forEach((blockHtml, blockIndex) => {
      const id = nextParagraphId(sectionKey, blockIndex);
      paragraphIds.push(id);
      paragraphs.push({
        id,
        order: paragraphs.length + 1,
        html: blockHtml,
        sectionTitle: section.title || undefined,
      });
    });

    const outlineId = `gtsec-${sectionKey}`;
    return {
      id: outlineId,
      title: section.title,
      level: section.level,
      order: section.order,
      paragraphIds,
      children: section.children?.length
        ? mapSectionsToOutline(section.children, paragraphs, sectionKey)
        : undefined,
    };
  });
}

/** 解析上传的 Word 模版：大纲（标题层级）+ 段落正文 */
export async function parseGeneralTemplateFromDocx(
  file: Blob,
  generalTemplateId: string,
  previousVersion = 0,
): Promise<GeneralTemplateParsedContent> {
  const { html } = await docxToHtml(file, { embedImages: true });
  return buildParsedContentFromHtml(html, generalTemplateId, previousVersion);
}

/** 从导出 HTML 构建解析结果（编辑器保存 / 重新解析） */
export function buildParsedContentFromHtml(
  html: string,
  generalTemplateId: string,
  previousVersion = 0,
): GeneralTemplateParsedContent {
  const rawSections = parseSectionsFromHTML(html, generalTemplateId);
  const paragraphs: GeneralTemplateParagraph[] = [];
  const sections = mapSectionsToOutline(rawSections, paragraphs);
  const now = new Date().toISOString();
  return {
    contentVersion: previousVersion > 0 ? previousVersion + 1 : 1,
    updatedAt: now,
    sections,
    paragraphs,
  };
}

export function countGeneralTemplateParagraphs(parsed: GeneralTemplateParsedContent): number {
  return parsed.paragraphs.length;
}

export function countGeneralTemplateOutlineSections(parsed: GeneralTemplateParsedContent): number {
  const walk = (nodes: GeneralTemplateOutlineSection[]): number =>
    nodes.reduce((n, s) => n + 1 + (s.children?.length ? walk(s.children) : 0), 0);
  return walk(parsed.sections);
}
