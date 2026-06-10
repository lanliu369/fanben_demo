import { Extension } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formatPainter: {
      startFormatPainter: () => ReturnType;
      applyFormatPainter: () => ReturnType;
      cancelFormatPainter: () => ReturnType;
    };
  }
}

interface FormatPainterStorage {
  active: boolean;
  marks: Array<{ type: string; attrs: Record<string, unknown> }>;
  nodeAttrs: {
    type: string;
    attrs: Record<string, unknown>;
  } | null;
}

interface MarkLike {
  type: { name: string };
  attrs: Record<string, unknown>;
}

interface NodeLike {
  isText?: boolean;
  marks?: MarkLike[];
  type: { name: string };
  attrs: Record<string, unknown>;
}

interface SelectionLike {
  from: number;
  to: number;
  empty: boolean;
  $from: {
    marks: () => MarkLike[];
    node: (depth: number) => NodeLike;
    depth: number;
  };
}

interface StateLike {
  selection: SelectionLike;
  storedMarks?: MarkLike[];
  doc: {
    nodesBetween: (
      from: number,
      to: number,
      cb: (node: NodeLike, pos: number) => void | boolean
    ) => void;
  };
}

interface ChainLike {
  focus: () => ChainLike;
  unsetAllMarks: () => ChainLike;
  setBold: () => ChainLike;
  setItalic: () => ChainLike;
  setUnderline: () => ChainLike;
  setStrike: () => ChainLike;
  setSuperscript: () => ChainLike;
  setSubscript: () => ChainLike;
  setFontFamily: (value: string) => ChainLike;
  setColor: (value: string) => ChainLike;
  setHighlight: (attrs: { color: string }) => ChainLike;
  setMark: (name: string, attrs: Record<string, unknown>) => ChainLike;
  setFontSize?: (value: string) => ChainLike;
  setLineHeight?: (value: string) => ChainLike;
  run: () => boolean;
}

interface CommandsLike {
  updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean;
  applyFormatPainter?: () => void;
}

export const FormatPainterExtension = Extension.create({
  name: 'formatPainter',

  addStorage() {
    return {
      active: false,
      marks: [] as Array<{ type: string; attrs: Record<string, unknown> }>,
      nodeAttrs: null,
    } as FormatPainterStorage;
  },

  addCommands() {
    return {
      startFormatPainter: () => ({ editor, state }: CommandProps) => {
        const painterStorage = (editor.storage as unknown as { formatPainter: FormatPainterStorage }).formatPainter;
        const localState = state as unknown as StateLike;
        const { from, to, empty } = localState.selection;
        const marks: Array<{ type: string; attrs: Record<string, unknown> }> = [];

        const collectMarks = (nodeMarks: MarkLike[]) => {
          nodeMarks.forEach((mark: MarkLike) => {
            if (!marks.find(m => m.type === mark.type.name)) {
              marks.push({ type: mark.type.name, attrs: { ...mark.attrs } });
            }
          });
        };

        if (empty) {
          const nodeMarks = localState.storedMarks ?? localState.selection.$from.marks();
          collectMarks(nodeMarks);
        } else {
          localState.doc.nodesBetween(from, Math.min(from + 1, to), (node: NodeLike) => {
            if (node.isText && node.marks) collectMarks(node.marks);
          });
        }

        // 收集段落级属性（当前光标所在段落/heading）
        const $from = localState.selection.$from;
        const parentNode = $from.node($from.depth);
        let nodeAttrs: FormatPainterStorage['nodeAttrs'] = null;
        if (parentNode && (parentNode.type.name === 'paragraph' || parentNode.type.name.startsWith('heading'))) {
          nodeAttrs = {
            type: parentNode.type.name,
            attrs: { ...parentNode.attrs },
          };
        }

        painterStorage.active = true;
        painterStorage.marks = marks;
        painterStorage.nodeAttrs = nodeAttrs;
        return true;
      },

      applyFormatPainter: () => ({ editor, state, chain, commands }: CommandProps) => {
        const painterStorage = (editor.storage as unknown as { formatPainter: FormatPainterStorage }).formatPainter;
        const localState = state as unknown as StateLike;
        if (localState.selection.empty) return false;
        const { marks, nodeAttrs } = painterStorage;

        // 1. 应用文字级 marks
        let cmd = chain().focus().unsetAllMarks() as unknown as ChainLike;

        marks.forEach(({ type, attrs }: { type: string; attrs: Record<string, unknown> }) => {
          switch (type) {
            case 'bold':        cmd = cmd.setBold(); break;
            case 'italic':      cmd = cmd.setItalic(); break;
            case 'underline':   cmd = cmd.setUnderline(); break;
            case 'strike':      cmd = cmd.setStrike(); break;
            case 'superscript': cmd = cmd.setSuperscript(); break;
            case 'subscript':   cmd = cmd.setSubscript(); break;
            case 'textStyle':
              if (attrs.fontFamily) cmd = cmd.setFontFamily(String(attrs.fontFamily));
              if (attrs.fontSize && cmd.setFontSize) cmd = cmd.setFontSize(String(attrs.fontSize));
              if (attrs.color) cmd = cmd.setColor(String(attrs.color));
              if (attrs.lineHeight && cmd.setLineHeight) cmd = cmd.setLineHeight(String(attrs.lineHeight));
              break;
            case 'highlight':
              if (attrs.color) cmd = cmd.setHighlight({ color: String(attrs.color) });
              break;
            case 'inlineStyle':
              // 兜底内联样式也复制
              cmd = cmd.setMark('inlineStyle', attrs);
              break;
          }
        });

        cmd.run();

        // 2. 应用段落级属性到选区内的所有 paragraph/heading
        if (nodeAttrs) {
          const { from, to } = localState.selection;
          const targetTypes = ['paragraph', 'heading'];
          const attrsToCopy: Record<string, unknown> = {};

          // 只复制有意义的段落属性
          const copyableAttrs = [
            'style',
            'class',
            'textAlign',
            'data-margin-top',
            'data-margin-bottom',
            'data-line-height',
            'data-text-indent',
            'data-margin-left',
            'data-margin-right',
            'data-style-id',
          ];

          copyableAttrs.forEach((key) => {
            if (nodeAttrs.attrs[key] !== undefined && nodeAttrs.attrs[key] !== null) {
              attrsToCopy[key] = nodeAttrs.attrs[key];
            }
          });

          if (Object.keys(attrsToCopy).length > 0) {
            localState.doc.nodesBetween(from, to, (node: NodeLike) => {
              if (targetTypes.includes(node.type.name) || node.type.name.startsWith('heading')) {
                // 需要区分 heading 和 paragraph 类型名
                const nodeType = node.type.name;
                (commands as unknown as CommandsLike).updateAttributes(nodeType, attrsToCopy);
              }
              return true;
            });
          }
        }

        painterStorage.active = false;
        painterStorage.marks = [];
        painterStorage.nodeAttrs = null;
        return true;
      },

      cancelFormatPainter: () => ({ editor }: CommandProps) => {
        const painterStorage = (editor.storage as unknown as { formatPainter: FormatPainterStorage }).formatPainter;
        painterStorage.active = false;
        painterStorage.marks = [];
        painterStorage.nodeAttrs = null;
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mouseup: () => {
              const storage = (this.editor?.storage as unknown as { formatPainter?: FormatPainterStorage } | undefined)?.formatPainter;
              if (!storage?.active) return false;
              const selection = this.editor?.state?.selection;
              if (selection && !selection.empty) {
                setTimeout(() => {
                  this.editor?.commands?.applyFormatPainter?.();
                }, 0);
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
