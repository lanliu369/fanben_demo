import { Node, mergeAttributes } from '@tiptap/core';

export const QuotedBlockExtension = Node.create({
  name: 'quotedBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      textFragmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-text-fragment-id'),
        renderHTML: (attributes) => {
          if (!attributes.textFragmentId) {
            return {};
          }
          return {
            'data-text-fragment-id': attributes.textFragmentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-text-fragment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'quoted-block' }),
      0,
    ];
  },
});
