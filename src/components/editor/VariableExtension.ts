import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VariableComponent } from './VariableComponent';

export interface VariableOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      setVariable: (options: { name: string; label: string }) => ReturnType;
    };
  }
}

export const VariableExtension = Node.create<VariableOptions>({
  name: 'variable',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-name'),
        renderHTML: (attributes) => {
          if (!attributes.name) {
            return {};
          }
          return {
            'data-name': attributes.name,
          };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return {
            'data-label': attributes.label,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'variable',
      }),
      `{{${HTMLAttributes.name}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableComponent);
  },

  addCommands() {
    return {
      setVariable:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
