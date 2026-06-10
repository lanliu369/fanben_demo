'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Table as TableIcon,
  Undo, Redo, Heading1, Heading2, Heading3,
} from 'lucide-react';
import type { TextFragment } from '@/types';
import { ResourceEmbedExtension } from '@/components/editor/extensions/ResourceEmbedExtension';

export interface RichTextEditorHandle {
  insertResourceEmbeds: (fragments: TextFragment[]) => void;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/** 与范本编辑器工具栏一致的字体、字号、行距选项（资源管理各页共用） */
const FONT_FAMILIES = [
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: '仿宋', value: 'FangSong, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
];

const FONT_SIZE_OPTIONS = [
  { label: '初号', value: '56px' },
  { label: '小初', value: '48px' },
  { label: '一号', value: '34.7px' },
  { label: '小一', value: '32px' },
  { label: '二号', value: '29.3px' },
  { label: '小二', value: '24px' },
  { label: '三号', value: '21.3px' },
  { label: '小三', value: '20px' },
  { label: '四号', value: '18.7px' },
  { label: '小四', value: '16px' },
  { label: '五号', value: '14px' },
  { label: '小五', value: '12px' },
];

const LINE_HEIGHTS = ['1.0', '1.15', '1.5', '2.0'];

function normalizeFontFamily(raw: string): string {
  if (!raw) return FONT_FAMILIES[0].value;
  const lower = raw.toLowerCase();
  if (lower.includes('simhei') || lower.includes('黑体')) return 'SimHei, sans-serif';
  if (lower.includes('simsun') || lower.includes('宋体')) return 'SimSun, serif';
  if (lower.includes('kaiti') || lower.includes('楷体')) return 'KaiTi, serif';
  if (lower.includes('fangsong') || lower.includes('仿宋')) return 'FangSong, serif';
  if (lower.includes('arial')) return 'Arial, sans-serif';
  if (lower.includes('times new roman')) return 'Times New Roman, serif';
  const hit = FONT_FAMILIES.find((f) => f.value === raw);
  return hit ? hit.value : raw;
}

function nearestFontSize(pxLike: string): string {
  const n = parseFloat(pxLike);
  if (Number.isNaN(n)) return '16px';
  return FONT_SIZE_OPTIONS.reduce((best, o) =>
    Math.abs(parseFloat(o.value) - n) < Math.abs(parseFloat(best.value) - n) ? o : best
  ).value;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, placeholder: _placeholder },
  ref,
) {
  const [, forceUpdate] = useState({});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        /** StarterKit v3 已内置 Underline，避免与下方独立 Underline 重复注册 */
        underline: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ['textStyle'] }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      ResourceEmbedExtension,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onSelectionUpdate: () => {
      forceUpdate({});
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  useImperativeHandle(ref, () => ({
    insertResourceEmbeds: (fragments: TextFragment[]) => {
      if (!editor) return;
      fragments.forEach((frag) => {
        editor.chain().focus().insertContent({
          type: 'resourceEmbed',
          attrs: { fragmentId: frag.id, label: frag.name || frag.id },
        }).run();
      });
    },
  }), [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const attrs = editor.getAttributes('textStyle');
  const fontFamily = normalizeFontFamily(String(attrs.fontFamily || ''));
  const rawSize = String(attrs.fontSize || '16px');
  const fontSize = FONT_SIZE_OPTIONS.some((o) => o.value === rawSize) ? rawSize : nearestFontSize(rawSize);
  const rawLh = String(attrs.lineHeight || '1.5');
  const lineHeight = LINE_HEIGHTS.includes(rawLh) ? rawLh : '1.5';

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* 工具栏 */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1 items-center">
        {/* 撤销/重做 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="撤销"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="重做"
        >
          <Redo className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 字体 / 字号 / 行距 */}
        <select
          value={fontFamily}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          className="no-saas-select px-2 py-1 text-xs border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 max-w-[120px]"
          onMouseDown={(e) => e.stopPropagation()}
          title="字体"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          value={fontSize}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
          className="no-saas-select px-2 py-1 text-xs border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 w-[88px]"
          onMouseDown={(e) => e.stopPropagation()}
          title="字号"
        >
          {FONT_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={LINE_HEIGHTS.includes(lineHeight) ? lineHeight : '1.5'}
          onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
          className="no-saas-select px-2 py-1 text-xs border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 w-[72px]"
          onMouseDown={(e) => e.stopPropagation()}
          title="行距"
        >
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>
              {lh}
            </option>
          ))}
        </select>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 标题 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-slate-200' : ''
          }`}
          title="一级标题"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-slate-200' : ''
          }`}
          title="二级标题"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-slate-200' : ''
          }`}
          title="三级标题"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 文本样式 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('bold') ? 'bg-slate-200' : ''
          }`}
          title="粗体"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('italic') ? 'bg-slate-200' : ''
          }`}
          title="斜体"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('underline') ? 'bg-slate-200' : ''
          }`}
          title="下划线"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 列表 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-slate-200' : ''
          }`}
          title="无序列表"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-slate-200' : ''
          }`}
          title="有序列表"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 对齐 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-slate-200' : ''
          }`}
          title="左对齐"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-slate-200' : ''
          }`}
          title="居中对齐"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-slate-200' : ''
          }`}
          title="右对齐"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* 表格 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="p-1.5 rounded hover:bg-slate-200 transition-colors"
          title="插入表格"
        >
          <TableIcon className="w-4 h-4" />
        </button>
        {editor.isActive('table') && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors"
              title="前插入列"
            >
              +列
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors"
              title="前插入行"
            >
              +行
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-rose-600"
              title="删除列"
            >
              -列
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-rose-600"
              title="删除行"
            >
              -行
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-rose-600"
              title="删除表格"
            >
              删除表格
            </button>
          </>
        )}
      </div>

      {/* 编辑区 */}
      <EditorContent editor={editor} />
    </div>
  );
});

export default RichTextEditor;
