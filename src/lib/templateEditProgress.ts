import type { GeneralTemplateParsedContent, Template, TemplateSection } from '@/types';
import { getGeneralTemplateParsedContent } from '@/lib/general-templates';
import { extractVariableKeysFromHtml } from '@/lib/generalTemplateStats';
import { extractFragmentIdsFromHtml } from '@/lib/quotedBlockHtml';
import { templateReferencesFragment } from '@/lib/textFragmentReference';

function generalTemplateHtml(parsed: GeneralTemplateParsedContent): string {
  return parsed.paragraphs.map((p) => p.html).join('\n');
}

function collectTemplateSectionsHtml(sections: TemplateSection[]): string {
  return sections
    .map((s) => `${s.content ?? ''}${s.children?.length ? collectTemplateSectionsHtml(s.children) : ''}`)
    .join('\n');
}

function collectTemplateVariableKeys(templateHtml: string): Set<string> {
  const keys = new Set(extractVariableKeysFromHtml(templateHtml));
  const attrRe = /data-template-variable=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(templateHtml)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    keys.add(raw.startsWith('{{') && raw.endsWith('}}') ? raw : `{{${raw}}}`);
  }
  return keys;
}

function flattenLeafSections(sections: TemplateSection[]): TemplateSection[] {
  const leaves: TemplateSection[] = [];
  const walk = (nodes: TemplateSection[]) => {
    for (const s of nodes) {
      if (s.children?.length) {
        walk(s.children);
      } else {
        leaves.push(s);
      }
    }
  };
  walk(sections);
  return leaves;
}

function sectionHasRequiredContent(section: TemplateSection): boolean {
  const raw = section.content ?? '';
  if (!raw.trim()) return false;
  if (/<table[\s>]/i.test(raw)) return true;
  const plain = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

/** 无通用模版引用时：按叶子章节是否有正文统计 */
function calcLegacyLeafSectionProgress(template: Template): number {
  const leafSections = flattenLeafSections(template.sections);
  if (leafSections.length === 0) return 0;
  const doneCount = leafSections.filter(sectionHasRequiredContent).length;
  return Math.round((doneCount / leafSections.length) * 100);
}

/**
 * 引用通用模版时：按模版内变量占位与资源引用的完成度统计。
 * 待办项 = 通用模版解析稿中的 {{变量}} 与 data-text-fragment-id 资源（去重）；
 * 已完成 = 范本章节正文中已出现对应变量键或资源 id。
 */
export function calcTemplateEditProgress(template: Template): number {
  const gtId = template.generalTemplateId?.trim();
  if (!gtId) {
    return calcLegacyLeafSectionProgress(template);
  }

  const parsed = getGeneralTemplateParsedContent(gtId);
  if (!parsed) {
    return calcLegacyLeafSectionProgress(template);
  }

  const gtHtml = generalTemplateHtml(parsed);
  const expectedVarKeys = extractVariableKeysFromHtml(gtHtml);
  const expectedResourceIds = extractFragmentIdsFromHtml(gtHtml);
  const total = expectedVarKeys.length + expectedResourceIds.length;

  if (total === 0) {
    return calcLegacyLeafSectionProgress(template);
  }

  const templateHtml = collectTemplateSectionsHtml(template.sections);
  const templateVarKeys = collectTemplateVariableKeys(templateHtml);

  const doneVars = expectedVarKeys.filter((key) => templateVarKeys.has(key)).length;
  const doneResources = expectedResourceIds.filter((id) => templateReferencesFragment(template, id)).length;

  return Math.round(((doneVars + doneResources) / total) * 100);
}
