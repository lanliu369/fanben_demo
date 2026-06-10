import { Mark } from '@tiptap/core';

/**
 * InlineStyle 扩展
 * 用于兜底保留所有 DOCX 导入时产生的内联样式 <span style="...">
 * 当其他专门的 Mark 扩展（如 fontFamily、fontSize、color 等）无法匹配时，
 * 此扩展作为最后保障，确保样式不丢失。
 */
export const InlineStyle = Mark.create({
  name: 'inlineStyle',

  priority: 1, // 低优先级，让其他专门扩展优先匹配

  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => {
          if (!attributes.style) {
            return {};
          }
          return { style: attributes.style };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => {
          // 只处理 HTMLElement
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          const style = element.getAttribute('style');
          // 只有当有 style 属性且不是空字符串时才匹配
          if (style && style.trim()) {
            return { style: style.trim() };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
