import type { GeneralTemplateParsedContent } from '@/types';
import { extractFragmentIdsFromHtml } from '@/lib/quotedBlockHtml';

const VARIABLE_PATTERN = /\{\{[^{}]+\}\}/g;

export function extractVariableKeysFromHtml(html: string): string[] {
  const keys = new Set<string>();
  for (const match of html.matchAll(VARIABLE_PATTERN)) {
    keys.add(match[0]);
  }
  return [...keys];
}

export function countVariablesInHtml(html: string): number {
  return extractVariableKeysFromHtml(html).length;
}

function parsedContentHtml(parsed: GeneralTemplateParsedContent): string {
  return parsed.paragraphs.map((p) => p.html).join('\n');
}

export function countGeneralTemplateVariables(parsed: GeneralTemplateParsedContent): number {
  return countVariablesInHtml(parsedContentHtml(parsed));
}

export function countGeneralTemplateResources(parsed: GeneralTemplateParsedContent): number {
  return extractFragmentIdsFromHtml(parsedContentHtml(parsed)).length;
}
