import { Node, mergeAttributes } from '@tiptap/core';

export const PageBreakExtension = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  parseHTML() {
    return [
      { tag: 'div.page-break' },
      { tag: 'p.page-break' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'page-break' }), ['br']];
  },
});
