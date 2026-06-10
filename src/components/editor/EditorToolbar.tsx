'use client';

import { useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Undo,
  Redo,
  RemoveFormatting,
  Type,
  Highlighter,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Search,
  Download,
  Printer,
  IndentIncrease,
  IndentDecrease,
  Paintbrush,
} from 'lucide-react';
import { exportWord } from './utils/exportWord';
import { TableFormatPanel } from './TableFormatPanel';

interface EditorToolbarProps {
  editor: Editor | null;
  templateName?: string;
  showFindReplace: boolean;
  onToggleFindReplace: () => void;
}

interface ToolbarButtonProps {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  tooltip?: string;
}

interface TextStyleMark {
  type: { name: string };
  attrs: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
}

interface TextNodeWithMarks {
  isText: boolean;
  marks?: readonly TextStyleMark[];
}

interface ExtendedCommands {
  setParagraphSpacing?: (value: string) => void;
  increaseIndent?: () => void;
  decreaseIndent?: () => void;
  startFormatPainter?: () => void;
  cancelFormatPainter?: () => void;
}

interface ExtendedChain {
  setFontSize?: (value: string) => { run: () => void };
  setLineHeight?: (value: string) => { run: () => void };
}

interface FormatPainterStorage {
  formatPainter?: {
    active?: boolean;
  };
}

function ToolbarButton({ onClick, active, disabled, children, tooltip }: ToolbarButtonProps) {
  return (
    <div className="relative group/btn">
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          onClick?.();
        }}
        disabled={disabled}
        className={`p-1.5 rounded transition-colors ${
          active
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-slate-100 text-slate-700'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        {children}
      </button>
      {tooltip && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-slate-800 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity delay-300 z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-slate-200 mx-0.5" />;
}

export function EditorToolbar({ editor, templateName = '范本', showFindReplace, onToggleFindReplace }: EditorToolbarProps) {
  const [showTableFormat, setShowTableFormat] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const fontFamilies = [
    { label: '宋体', value: 'SimSun, serif' },
    { label: '黑体', value: 'SimHei, sans-serif' },
    { label: '楷体', value: 'KaiTi, serif' },
    { label: '仿宋', value: 'FangSong, serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
  ];

  const fontSizeOptions = [
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

  const headingLevels = [
    { label: '正文', value: 0 },
    { label: '标题 1', value: 1 },
    { label: '标题 2', value: 2 },
    { label: '标题 3', value: 3 },
    { label: '标题 4', value: 4 },
    { label: '标题 5', value: 5 },
    { label: '标题 6', value: 6 },
  ];

  const lineHeights = ['1.0', '1.15', '1.5', '2.0'];
  const paragraphSpacings = [
    { label: '无', value: '0' },
    { label: '小', value: '6px' },
    { label: '中', value: '12px' },
    { label: '大', value: '24px' },
  ];

  const textColors = [
    '#000000', '#434343', '#666666', '#999999', '#B7B7B7',
    '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
    '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00',
    '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  ];

  const highlightColors = [
    { label: '黄色', value: '#FFF176' },
    { label: '绿色', value: '#AED581' },
    { label: '蓝色', value: '#64B5F6' },
    { label: '粉色', value: '#F06292' },
    { label: '橙色', value: '#FFB74D' },
    { label: '紫色', value: '#BA68C8' },
    { label: '青色', value: '#4DD0E1' },
    { label: '红色', value: '#E57373' },
    { label: '灰色', value: '#E0E0E0' },
    { label: '无', value: 'transparent' },
  ];

  // 获取当前选区的格式属性
  const getActiveAttributes = () => {
    if (!editor || !editor.state || !editor.state.selection) {
      return {
        fontFamily: '宋体',
        fontSize: '12px',
        lineHeight: '1.5',
      };
    }

    const { from, to, empty } = editor.state.selection;
    let fontFamily = '';
    let fontSize = '';
    let lineHeight = '';

    // 优先从段落/heading 节点的 style 属性提取（Word 导入格式主要在段落级）
    const { $from } = editor.state.selection;
    const parentNode = $from.node($from.depth);
    if (parentNode && (parentNode.type.name === 'paragraph' || parentNode.type.name.startsWith('heading'))) {
      const style = (parentNode.attrs.style as string) || '';
      const mFamily = style.match(/font-family:\s*([^;]+)/i);
      const mSize = style.match(/font-size:\s*([^;]+)/i);
      const mLine = style.match(/line-height:\s*([^;]+)/i);
      if (mFamily) fontFamily = mFamily[1].trim();
      if (mSize) fontSize = mSize[1].trim();
      if (mLine) lineHeight = mLine[1].trim();
    }

    // 然后看 textStyle marks（选区内有更细粒度设置时覆盖段落级）
    const collectMarks = () => {
      let f = '';
      let s = '';
      let l = '';
      if (empty) {
        const marks = editor.state.storedMarks ?? editor.state.selection.$from.marks();
        marks.forEach((mark: TextStyleMark) => {
          if (mark.type.name === 'textStyle') {
            f = mark.attrs.fontFamily || f;
            s = mark.attrs.fontSize || s;
            l = mark.attrs.lineHeight || l;
          }
        });
      } else {
        editor.state.doc.nodesBetween(from, to, (node) => {
          const textNode = node as unknown as TextNodeWithMarks;
          if (textNode.isText && textNode.marks) {
            textNode.marks.forEach((mark: TextStyleMark) => {
              if (mark.type.name === 'textStyle') {
                f = f || mark.attrs.fontFamily || '';
                s = s || mark.attrs.fontSize || '';
                l = l || mark.attrs.lineHeight || '';
              }
            });
          }
        });
      }
      return { f, s, l };
    };

    const { f: markFamily, s: markSize, l: markLine } = collectMarks();
    if (markFamily) fontFamily = markFamily;
    if (markSize) fontSize = markSize;
    if (markLine) lineHeight = markLine;

    // fallback: getAttributes('textStyle')
    if (!fontFamily || !fontSize || !lineHeight) {
      const attrs = editor.getAttributes('textStyle');
      if (!fontSize) fontSize = attrs.fontSize || '';
      if (!lineHeight) lineHeight = attrs.lineHeight || '';
    }

    // heading 默认字号 fallback（与 parser 保持一致）
    if (!fontSize && parentNode && parentNode.type.name === 'heading') {
      const level = Number(parentNode.attrs.level);
      const headingDefaults: Record<number, string> = {
        1: '21.3px', // 三号
        2: '20px',   // 小三
        3: '18.7px', // 四号
        4: '16px',   // 小四
        5: '16px',
        6: '16px',
      };
      fontSize = headingDefaults[level] || '';
    }

    // 把解析出的原始字体名映射为下拉框的 value
    const normalizeFontFamily = (raw: string) => {
      if (!raw) return '';
      const lower = raw.toLowerCase();
      if (lower.includes('simhei') || lower.includes('黑体')) return 'SimHei, sans-serif';
      if (lower.includes('simsun') || lower.includes('宋体')) return 'SimSun, serif';
      if (lower.includes('kaiti') || lower.includes('楷体')) return 'KaiTi, serif';
      if (lower.includes('fangsong') || lower.includes('仿宋')) return 'FangSong, serif';
      if (lower.includes('arial')) return 'Arial, sans-serif';
      if (lower.includes('times new roman')) return 'Times New Roman, serif';
      return raw;
    };

    fontFamily = normalizeFontFamily(fontFamily);

    return {
      fontFamily: fontFamily || '宋体',
      fontSize: fontSize || '12px',
      lineHeight: lineHeight || '1.5',
    };
  };

  const { fontFamily: currentFontFamily, fontSize: currentFontSize, lineHeight: currentLineHeight } = getActiveAttributes();

  let currentHeading = 0;
  for (let i = 1; i <= 6; i++) {
    if (editor.isActive('heading', { level: i })) {
      currentHeading = i;
      break;
    }
  }
  // fallback：直接检查当前选区所在父节点类型
  if (currentHeading === 0) {
    const { $from } = editor.state.selection;
    const parent = $from.node($from.depth);
    if (parent && parent.type.name === 'heading') {
      const lvl = Number(parent.attrs.level);
      if (lvl >= 1 && lvl <= 6) currentHeading = lvl;
    }
  }

  const isInTable = editor.isActive('table');

  const handleExportWord = async () => {
    const html = editor.getHTML();
    await exportWord(html, templateName);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleInsertLink = () => {
    const url = window.prompt('输入链接地址:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleInsertImage = () => {
    // 优先尝试文件上传
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        editor.chain().focus().setImage({ src: base64 }).run();
      }
    };
    reader.readAsDataURL(file);

    // 清空 input 以便重复选择同一文件
    e.target.value = '';
  };

  const handleInsertImageUrl = () => {
    const url = window.prompt('输入图片地址:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const isFormatPainterActive = (editor.storage as unknown as FormatPainterStorage).formatPainter?.active ?? false;
  const extendedCommands = editor.commands as unknown as ExtendedCommands;
  const extendedChain = editor.chain().focus() as unknown as ExtendedChain;

  return (
    <div className="flex flex-col">
      {/* 第一行 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100">
        {/* 撤销/重做/清除格式/格式刷 */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} tooltip="撤销">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} tooltip="重做">
          <Redo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} tooltip="清除格式">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            if (isFormatPainterActive) {
              extendedCommands.cancelFormatPainter?.();
            } else {
              extendedCommands.startFormatPainter?.();
            }
          }}
          active={isFormatPainterActive}
          tooltip="格式刷（先选中源文字，点击格式刷，再选中目标文字）"
        >
          <Paintbrush className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* 字体 */}
        <select
          value={currentFontFamily}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          className="no-saas-select px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* 字号 */}
        <select
          value={currentFontSize}
          onChange={(e) => extendedChain.setFontSize?.(e.target.value)?.run()}
          className="no-saas-select px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 w-20"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {fontSizeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <Divider />

        {/* 段落样式 */}
        <select
          value={currentHeading}
          onChange={(e) => {
            const level = parseInt(e.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
            }
          }}
          className="no-saas-select px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {headingLevels.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>

        {/* 文本颜色 */}
        <div className="relative group/color">
          <ToolbarButton tooltip="文本颜色">
            <Type className="w-4 h-4" />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover/color:block bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {textColors.map((color) => (
                <button
                  key={color}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(color).run();
                  }}
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 高亮颜色 */}
        <div className="relative group/highlight">
          <ToolbarButton tooltip="高亮颜色">
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover/highlight:block bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {highlightColors.map((color) => (
                <button
                  key={color.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setHighlight({ color: color.value }).run();
                  }}
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>

        <Divider />

        {/* 对齐 */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} tooltip="左对齐">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} tooltip="居中">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} tooltip="右对齐">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} tooltip="两端对齐">
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => {
            // 检查当前是否已经是分散对齐
            const selection = editor.state.selection;
            let hasDistributeClass = false;
            
            // 检查选区中的节点是否有 text-distribute 类
            editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
              if (node.type.name === 'paragraph' || node.type.name.startsWith('heading')) {
                if (node.attrs.class?.includes('text-distribute')) {
                  hasDistributeClass = true;
                  return false; // 停止遍历
                }
              }
              return true;
            });
            
            if (hasDistributeClass) {
              // 如果已经是分散对齐，则取消（改为左对齐）
              editor.chain().focus().setTextAlign('left').run();
              editor.chain().focus().updateAttributes('paragraph', { class: null }).run();
              editor.chain().focus().updateAttributes('heading', { class: null }).run();
            } else {
              // 设置为分散对齐
              editor.chain().focus().setTextAlign('justify').run();
              // 尝试更新段落或标题的 class
              const { from, to } = selection;
              editor.state.doc.nodesBetween(from, to, (node, pos) => {
                if (node.type.name === 'paragraph' || node.type.name.startsWith('heading')) {
                  editor.chain().focus().setNodeSelection(pos).updateAttributes(node.type.name, { class: 'text-distribute' }).run();
                  return false;
                }
                return true;
              });
            }
          }} 
          active={(() => {
            const selection = editor.state.selection;
            let hasDistributeClass = false;
            editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
              if (node.type.name === 'paragraph' || node.type.name.startsWith('heading')) {
                if (node.attrs.class?.includes('text-distribute')) {
                  hasDistributeClass = true;
                  return false;
                }
              }
              return true;
            });
            return hasDistributeClass;
          })()} 
          tooltip="分散对齐"
        >
          {/* 分散对齐图标 */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </ToolbarButton>
      </div>

      {/* 第二行 */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* 行距 */}
        <select
          value={currentLineHeight}
          onChange={(e) => extendedChain.setLineHeight?.(e.target.value)?.run()}
          className="no-saas-select px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 w-20"
          onMouseDown={(e) => e.stopPropagation()}
          title="行距"
        >
          {lineHeights.map((lh) => (
            <option key={lh} value={lh}>
              {lh}
            </option>
          ))}
        </select>

        {/* 段后距 */}
        <select
          onChange={(e) => extendedCommands.setParagraphSpacing?.(e.target.value)}
          className="no-saas-select px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:border-blue-500 w-20"
          onMouseDown={(e) => e.stopPropagation()}
          title="段后距"
        >
          {paragraphSpacings.map((ps) => (
            <option key={ps.value} value={ps.value}>
              {ps.label}
            </option>
          ))}
        </select>

        {/* 缩进 */}
        <ToolbarButton onClick={() => extendedCommands.increaseIndent?.()} tooltip="增加缩进">
          <IndentIncrease className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => extendedCommands.decreaseIndent?.()} tooltip="减少缩进">
          <IndentDecrease className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* 列表 */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} tooltip="无序列表">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} tooltip="有序列表">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} tooltip="任务清单">
          <CheckSquare className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* 引用/代码块/分割线 */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} tooltip="引用">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} tooltip="代码块">
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} tooltip="分割线">
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* 链接/图片 */}
        <ToolbarButton onClick={handleInsertLink} active={editor.isActive('link')} tooltip="插入链接">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <div className="relative group/image">
          <ToolbarButton tooltip="插入图片">
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover/image:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 w-40">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertImage();
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
            >
              上传本地图片
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertImageUrl();
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
            >
              输入图片地址
            </button>
          </div>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          className="hidden"
        />

        <Divider />

        {/* 表格操作 */}
        <div className="relative group">
          <ToolbarButton disabled={!isInTable} tooltip="表格操作">
            <TableIcon className="w-4 h-4" />
          </ToolbarButton>
          {isInTable && (
            <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 w-40">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().addRowBefore().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                在上方插入行
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().addRowAfter().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                在下方插入行
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().deleteRow().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                删除行
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().addColumnBefore().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                在左侧插入列
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().addColumnAfter().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                在右侧插入列
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().deleteColumn().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                删除列
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().mergeCells().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                合并单元格
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().splitCell().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                拆分单元格
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowTableFormat(true);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
              >
                表格格式设置
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().deleteTable().run();
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors text-rose-600"
              >
                删除表格
              </button>
            </div>
          )}
        </div>

        {!isInTable && (
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            tooltip="插入表格"
          >
            <TableIcon className="w-4 h-4" />
          </ToolbarButton>
        )}

        <Divider />

        {/* 查找替换 */}
        <ToolbarButton onClick={onToggleFindReplace} active={showFindReplace} tooltip="查找替换">
          <Search className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* 导出 */}
        <ToolbarButton onClick={handleExportWord} tooltip="导出 Word">
          <Download className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleExportPDF} tooltip="打印/导出 PDF">
          <Printer className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* 表格格式设置面板 */}
      {showTableFormat && (
        <TableFormatPanel
          editor={editor}
          onClose={() => setShowTableFormat(false)}
        />
      )}
    </div>
  );
}
