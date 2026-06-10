import type { Template, TemplateSection, TextBinding } from '@/types';

/** 绑定是否命中当前范本章节（新版：范本+章节；兼容旧版：框架+chapterId） */
export function bindingMatchesSection(binding: TextBinding, tpl: Template, sec: TemplateSection): boolean {
  if (binding.templateId && binding.templateSectionId) {
    return binding.templateId === tpl.id && binding.templateSectionId === sec.id;
  }
  if (binding.frameworkId && binding.chapterId && tpl.frameworkId) {
    return binding.frameworkId === tpl.frameworkId && binding.chapterId === sec.chapterId;
  }
  return false;
}

/** 资源发布时判断某条绑定是否与指定范本有关（用于同步范本正文） */
export function bindingTouchesTemplate(binding: TextBinding, tpl: Template): boolean {
  if (binding.templateId) {
    return binding.templateId === tpl.id;
  }
  if (binding.frameworkId && tpl.frameworkId) {
    return binding.frameworkId === tpl.frameworkId;
  }
  return false;
}
