import { Node, mergeAttributes } from '@tiptap/core';

/** 资源管理正文：嵌入其它资源占位（范本侧按品类展开正文） */
export const ResourceEmbedExtension = Node.create({
  name: 'resourceEmbed',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fragmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-fragment-id'),
      },
      label: {
        default: '',
        parseHTML: (el) =>
          el.getAttribute('data-fragment-name') || el.textContent || '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-resource-embed="1"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? '');
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-resource-embed': '1',
        'data-fragment-id': String(node.attrs.fragmentId ?? ''),
        'data-fragment-name': label,
        class: 'resource-embed-pill',
        contenteditable: 'false',
        style:
          'display:inline-block;padding:2px 10px;margin:0 2px;background:#dbeafe;color:#1e40af;' +
          'border-radius:6px;font-size:0.92em;font-weight:600;border:1px solid #93c5fd;vertical-align:baseline;',
      }),
      label,
    ];
  },
});
