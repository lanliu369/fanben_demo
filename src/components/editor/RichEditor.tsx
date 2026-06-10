'use client';

import { forwardRef, useImperativeHandle, useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { OutlineItem } from '@/types';
import StarterKit from '@tiptap/starter-kit';
import { Heading } from '@tiptap/extension-heading';
import { Paragraph } from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize, LineHeight, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableRow, TableHeader, TableCell as BaseTableCell } from '@tiptap/extension-table';

const TableCell = BaseTableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },
});
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import CharacterCount from '@tiptap/extension-character-count';
import { VariableExtension } from './VariableExtension';
import { EditorToolbar } from './EditorToolbar';
import { TextIndentExtension } from './extensions/TextIndentExtension';
import { ParagraphSpacingExtension } from './extensions/ParagraphSpacingExtension';
import { SearchHighlightExtension } from './extensions/SearchHighlightExtension';
import { FormatPainterExtension } from './extensions/FormatPainterExtension';
import { InlineStyle } from './extensions/InlineStyleExtension';
import { QuotedBlockExtension } from './QuotedBlockExtension';
import { PageBreakExtension } from './PageBreakExtension';
import { FindReplacePanel } from './FindReplacePanel';

/**
 * 根据章节标题文本检测其层级
 * 支持中文标书常见的编号体系
 * @param isHeading 是否为 heading 节点（heading 允许匹配更多模式）
 */
function detectTitleLevel(text: string, isHeading: boolean = false): number {
  const t = text.trim();

  // 卷级：第一卷、第二卷...
  if (/^第[一二三四五六七八九十百千]+卷/.test(t)) return 1;
  // 章级：第一章、第二章...
  if (/^第[一二三四五六七八九十百千]+章/.test(t)) return 2;
  // 前附表（以...前附表开头，避免正文"详见前附表"被误匹配）
  if (/^(投标人须知|评标办法|合同条款).*前附表/.test(t)) return 3;
  if (/^附\s*录/.test(t)) return 3;
  if (/^续表/.test(t)) return 4;

  // 数字编号：1. / 1.1 / 1.1.1 / 1.1.1.1
  const numMatch = t.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?\s/);
  if (numMatch) {
    if (numMatch[4]) return 6;
    if (numMatch[3]) return 5;
    if (numMatch[2]) return 4;
    return 3;
  }

  // 中文编号：一、二、三...
  if (/^[一二三四五六七八九十]+、/.test(t)) return 4;

  // 深层条款编号只在 heading 节点中匹配（避免正文列表项混入导航）
  if (isHeading) {
    if (/^（[0-9]+）/.test(t)) return 5;
  }

  return 0; // 不匹配任何章节标题模式
}

interface OutlineNode {
  type: { name: string };
  attrs: { level?: number };
  textContent: string;
  isText?: boolean;
}

interface OutlineDoc {
  descendants: (cb: (node: OutlineNode, pos: number) => void | boolean) => void;
}

/**
 * 提取文档大纲
 * 同时扫描 heading 和 paragraph 节点，根据内容编号模式推断层级
 */
function extractOutline(doc: OutlineDoc): OutlineItem[] {
  const items: OutlineItem[] = [];

  doc.descendants((node: OutlineNode, pos: number) => {
    const type = node.type.name;
    let level = 0;
    let text = '';

    if (type === 'heading') {
      level = node.attrs.level ?? 1;
      text = node.textContent;
      const detected = detectTitleLevel(text, true);
      if (detected > 0) {
        level = detected;
      }
    } else if (type === 'paragraph') {
      text = node.textContent;
      const detected = detectTitleLevel(text, false);
      if (detected > 0) {
        level = detected;
      }
    } else {
      return;
    }

    if (level > 0) {
      items.push({ level, text, pos });
    }
  });

  return items;
}

export interface RichEditorHandle {
  insertVariable: (name: string, label: string) => void;
  getHTML: () => string;
  setSearchTerm: (term: string) => void;
  insertHeading: (level: number) => void;
  scrollToPos: (pos: number) => void;
  deleteHeadingAtPos: (pos: number) => void;
  insertHTML: (html: string) => void;
  insertQuotedBlock: (html: string, textFragmentId: string) => void;
}

interface Props {
  content: string;
  onChange?: (html: string) => void;
  templateName?: string;
  onOutlineChange?: (outline: OutlineItem[]) => void;
  layoutMode?: 'a4' | 'natural';
  pageMargins?: { top: string; right: string; bottom: string; left: string };
}

interface RichEditorCommands {
  setSearchTerm?: (term: string) => void;
}

const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor(
  { content, onChange, templateName = '范本', onOutlineChange, layoutMode = 'a4', pageMargins },
  ref
) {
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [, forceUpdate] = useState({});

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const onOutlineChangeRef = useRef(onOutlineChange);
  useEffect(() => { onOutlineChangeRef.current = onOutlineChange; }, [onOutlineChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        underline: false,
        link: false,
      }),
      Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      Paragraph,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ['textStyle'] }),
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({ openOnClick: false }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => element.getAttribute('style'),
              renderHTML: (attributes) => {
                if (!attributes.style) return {};
                return { style: attributes.style };
              },
            },
            'data-image-id': {
              default: null,
              parseHTML: (element) => element.getAttribute('data-image-id'),
              renderHTML: (attributes) => {
                if (!attributes['data-image-id']) return {};
                return { 'data-image-id': attributes['data-image-id'] };
              },
            },
          };
        },
      }).configure({ allowBase64: true }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      TextIndentExtension,
      ParagraphSpacingExtension,
      SearchHighlightExtension,
      FormatPainterExtension,
      InlineStyle,
      QuotedBlockExtension,
      PageBreakExtension,
      VariableExtension,
    ],
    content: content || '<p></p>',
    onCreate({ editor }) {
      onOutlineChangeRef.current?.(extractOutline(editor.state.doc));
    },
    onUpdate({ editor }) {
      onChangeRef.current?.(editor.getHTML());
      onOutlineChangeRef.current?.(extractOutline(editor.state.doc));
    },
    onSelectionUpdate() {
      forceUpdate({});
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-full',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== content) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
      onOutlineChangeRef.current?.(extractOutline(editor.state.doc));
    }
  }, [content, editor]);

  useImperativeHandle(ref, () => ({
    insertVariable(name: string, label: string) {
      editor?.chain().focus().setVariable({ name, label }).run();
    },
    getHTML() {
      return editor?.getHTML() ?? '';
    },
    setSearchTerm(term: string) {
      const commands = editor?.commands as unknown as RichEditorCommands | undefined;
      commands?.setSearchTerm?.(term);
    },
    insertHeading(level: number) {
      if (!editor) return;
      const end = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(end, [
        { type: 'heading', attrs: { level }, content: [{ type: 'text', text: '新章节' }] },
        { type: 'paragraph' },
      ]).run();
    },
    scrollToPos(pos: number) {
      if (!editor) return;
      editor.commands.setTextSelection(pos + 1);
      const dom = editor.view.domAtPos(pos + 1).node as HTMLElement;
      dom?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    },
    deleteHeadingAtPos(pos: number) {
      if (!editor) return;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'heading') return;
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    },
    insertHTML(html: string) {
      if (!editor) return;
      editor.chain().focus().insertContent(html).run();
    },
    insertQuotedBlock(html: string, textFragmentId: string) {
      if (!editor) return;
      editor.chain().focus().insertContent(
        `<div data-text-fragment-id="${textFragmentId}" class="quoted-block">${html}</div>`
      ).run();
    },
  }));

  const charCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 工具栏固定在顶部 */}
      <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm relative">
        <EditorToolbar
          editor={editor}
          templateName={templateName}
          showFindReplace={showFindReplace}
          onToggleFindReplace={() => setShowFindReplace(v => !v)}
        />
        {showFindReplace && (
          <FindReplacePanel
            editor={editor}
            onClose={() => setShowFindReplace(false)}
          />
        )}
      </div>

      {/* 可滚动的编辑区域 */}
      <div className="flex-1 overflow-y-auto py-6 editor-scroll-area">
        {layoutMode === 'a4' ? (
          <div
            className="mx-auto bg-white shadow-md a4-page docx-editor-container"
            style={{
              width: '794px',
              minHeight: '1123px',
              padding: pageMargins
                ? `${pageMargins.top} ${pageMargins.right} ${pageMargins.bottom} ${pageMargins.left}`
                : '96px 90px',
            }}
          >
            <EditorContent editor={editor} className="h-full" />
          </div>
        ) : (
          <div className="mx-auto bg-white shadow-md max-w-4xl">
            <div className="docx-preview p-8">
              <EditorContent editor={editor} className="h-full" />
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="shrink-0 px-4 py-1 text-xs text-slate-400 bg-white border-t border-slate-100 text-right editor-status-bar">
        {charCount} 字符 · {wordCount} 词
      </div>
    </div>
  );
});

export default RichEditor;
