import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphSpacing: {
      setParagraphSpacing: (spacing: string) => ReturnType;
      unsetParagraphSpacing: () => ReturnType;
    };
  }
}

interface ParagraphSpacingChain {
  updateAttributes: (type: string, attrs: Record<string, unknown>) => {
    run: () => boolean;
  };
}

export const ParagraphSpacingExtension = Extension.create({
  name: 'paragraphSpacing',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          paragraphSpacing: {
            default: null,
            parseHTML: element => element.style.marginBottom || null,
            renderHTML: attributes => {
              if (!attributes.paragraphSpacing) return {};
              return { style: `margin-bottom: ${attributes.paragraphSpacing}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setParagraphSpacing: (spacing: string) => ({ chain }: { chain: () => ParagraphSpacingChain }) => {
        return chain().updateAttributes('paragraph', { paragraphSpacing: spacing }).run();
      },
      unsetParagraphSpacing: () => ({ chain }: { chain: () => ParagraphSpacingChain }) => {
        return chain().updateAttributes('paragraph', { paragraphSpacing: null }).run();
      },
    };
  },
});
