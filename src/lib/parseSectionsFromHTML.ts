import type { TemplateSection } from '@/types';

/** 将 HTML 正文解析为范本章节树（与 Tiptap / 金山 WebOffice 导出 HTML 结构约定一致） */
export function parseSectionsFromHTML(html: string, templateId: string): TemplateSection[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sections: TemplateSection[] = [];
  const stack: TemplateSection[] = [];

  const appendContentToCurrent = (el: HTMLElement) => {
    const current = stack[stack.length - 1];
    if (!current) return false;
    // 资源引用块保留完整 outerHTML（含 data-text-fragment-id），便于块级高亮、同步与解除关联
    current.content += el.outerHTML;
    return true;
  };

  const createDefaultSection = () => {
    const section: TemplateSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      templateId,
      chapterId: '',
      title: '',
      order: sections.length + 1,
      level: 1,
      content: '',
    };
    sections.push(section);
    stack.push(section);
    return section;
  };

  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag.match(/^h[1-6]$/)) {
        const titleText = el.textContent?.trim() || '';
        if (!titleText) {
          if (!appendContentToCurrent(el)) {
            createDefaultSection();
            appendContentToCurrent(el);
          }
          return;
        }
        const level = parseInt(tag[1], 10);
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        const parent = stack[stack.length - 1];
        const order = parent ? ((parent.children?.length ?? 0) + 1) : (sections.length + 1);
        const newSection: TemplateSection = {
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          templateId,
          chapterId: '',
          title: titleText,
          order,
          level,
          content: '',
        };
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(newSection);
        } else {
          sections.push(newSection);
        }
        stack.push(newSection);
      } else {
        if (!appendContentToCurrent(el)) {
          createDefaultSection();
          appendContentToCurrent(el);
        }
      }
    }
  });

  return sections;
}
