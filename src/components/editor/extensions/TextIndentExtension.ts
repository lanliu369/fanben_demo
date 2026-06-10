import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textIndent: {
      setTextIndent: (indent: string) => ReturnType;
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

interface TextIndentCommands {
  updateAttributes: (type: string, attrs: { textIndent: string }) => boolean;
  setTextIndent: (indent: string) => boolean;
}

interface TextIndentEditorLike {
  getAttributes: (type: string) => { textIndent?: string };
}

export const TextIndentExtension = Extension.create({
  name: 'textIndent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      indentUnit: '2em',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.textIndent) {
                return {};
              }
              return {
                style: `text-indent: ${attributes.textIndent}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextIndent:
        (indent: string) =>
        ({ commands }: { commands: TextIndentCommands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { textIndent: indent })
          );
        },

      increaseIndent:
        () =>
        ({ commands, editor }: { commands: TextIndentCommands; editor: TextIndentEditorLike }) => {
          const { textIndent } = editor.getAttributes('paragraph');
          const currentIndent = textIndent ? parseFloat(textIndent) : 0;
          const newIndent = `${currentIndent + 2}em`;
          return commands.setTextIndent(newIndent);
        },

      decreaseIndent:
        () =>
        ({ commands, editor }: { commands: TextIndentCommands; editor: TextIndentEditorLike }) => {
          const { textIndent } = editor.getAttributes('paragraph');
          const currentIndent = textIndent ? parseFloat(textIndent) : 0;
          if (currentIndent <= 0) {
            return commands.setTextIndent('0em');
          }
          const newIndent = `${currentIndent - 2}em`;
          return commands.setTextIndent(newIndent);
        },
    };
  },
});
