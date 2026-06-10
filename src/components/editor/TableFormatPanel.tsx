'use client';

import { Editor } from '@tiptap/react';
import { useState } from 'react';
import { X, AlignCenter, AlignLeft, AlignRight, Minus, Square, AlignStartVertical, AlignEndVertical } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

interface TableFormatPanelProps {
  editor: Editor | null;
  onClose: () => void;
}

const borderStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' },
  { label: '双线', value: 'double' },
  { label: '无边框', value: 'none' },
];

const borderWidths = [
  { label: '细', value: '0.5px' },
  { label: '中', value: '1px' },
  { label: '粗', value: '2px' },
  { label: '特粗', value: '3px' },
];

const colors = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#FF0000', '#FF6600', '#FFCC00', '#00FF00', '#00CCFF', '#0066FF',
  '#9900FF', '#FF00FF', '#FF0066', '#8B4513', '#228B22', '#4169E1',
];

export function TableFormatPanel({ editor, onClose }: TableFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<'border' | 'background' | 'align' | 'table'>('border');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [borderWidth, setBorderWidth] = useState('1px');
  const [borderColor, setBorderColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [verticalAlign, setVerticalAlign] = useState('middle');
  const [horizontalAlign, setHorizontalAlign] = useState('left');
  const [screenOnlyBorder, setScreenOnlyBorder] = useState(false);
  const [tableWidth, setTableWidth] = useState('100%');
  const [tableAlign, setTableAlign] = useState<'left' | 'center' | 'right'>('center');

  if (!editor) return null;

  const applyBorder = (type: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'none') => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const borderValue = type === 'none' ? 'none' : `${borderWidth} ${borderStyle} ${borderColor}`;

    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        let style = (node.attrs.style as string) || '';
        
        // 移除现有的边框样式
        style = style.replace(/border[^:]*:\s*[^;]+;?/g, '');
        
        if (type === 'all') {
          style += `border: ${borderValue};`;
        } else if (type === 'top') {
          style += `border-top: ${borderValue};`;
        } else if (type === 'bottom') {
          style += `border-bottom: ${borderValue};`;
        } else if (type === 'left') {
          style += `border-left: ${borderValue};`;
        } else if (type === 'right') {
          style += `border-right: ${borderValue};`;
        } else if (type === 'none') {
          style += 'border: none;';
        }
        
        editor.chain().focus().setNodeSelection(pos).updateAttributes(node.type.name, { style }).run();
        return false;
      }
      return true;
    });
  };

  const applyBackgroundColor = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        editor.chain().focus().setNodeSelection(pos).updateAttributes(node.type.name, { 
          bgcolor: bgColor,
          style: ((node.attrs.style as string) || '') + `background-color: ${bgColor};`
        }).run();
        return false;
      }
      return true;
    });
  };

  const applyAlignment = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        let style = (node.attrs.style as string) || '';
        
        // 移除现有的对齐样式
        style = style.replace(/vertical-align:\s*\w+;?/g, '');
        style = style.replace(/text-align:\s*\w+;?/g, '');
        
        style += `vertical-align: ${verticalAlign};text-align: ${horizontalAlign};`;
        
        editor.chain().focus().setNodeSelection(pos).updateAttributes(node.type.name, { 
          style,
          valign: verticalAlign
        }).run();
        return false;
      }
      return true;
    });
  };

  const toggleScreenOnlyBorder = () => {
    if (!editor) return;
    const { from } = editor.state.selection;
    let tablePos = -1;
    editor.state.doc.nodesBetween(from, from + 1, (node, pos) => {
      if (node.type.name === 'table') {
        tablePos = pos;
        return false;
      }
      return true;
    });
    if (tablePos === -1) return;
    const tableNode = editor.state.doc.nodeAt(tablePos);
    if (!tableNode) return;
    const currentClass = (tableNode.attrs.class as string) || '';
    let nextClass = currentClass;
    if (screenOnlyBorder) {
      nextClass = currentClass.replace(/screen-only-border/g, '').trim().replace(/\s+/g, ' ');
    } else {
      nextClass = currentClass ? `${currentClass} screen-only-border` : 'screen-only-border';
    }
    editor.chain().focus().setNodeSelection(tablePos).updateAttributes('table', {
      class: nextClass || null,
    }).run();
    setScreenOnlyBorder(!screenOnlyBorder);
  };

  const applyTableFormat = () => {
    if (!editor) return;
    const { from } = editor.state.selection;
    let tablePos = -1;
    editor.state.doc.nodesBetween(from, from + 1, (node, pos) => {
      if (node.type.name === 'table') {
        tablePos = pos;
        return false;
      }
      return true;
    });
    if (tablePos === -1) return;

    const tableNode = editor.state.doc.nodeAt(tablePos);
    if (!tableNode) return;

    let style = (tableNode.attrs.style as string) || '';
    // 移除现有 width 和 margin
    style = style.replace(/width:\s*[^;]+;?/g, '');
    style = style.replace(/margin-left:\s*[^;]+;?/g, '');
    style = style.replace(/margin-right:\s*[^;]+;?/g, '');

    style += `width:${tableWidth};`;
    if (tableAlign === 'center') {
      style += 'margin-left:auto;margin-right:auto;';
    } else if (tableAlign === 'right') {
      style += 'margin-left:auto;margin-right:0;';
    } else {
      style += 'margin-left:0;margin-right:auto;';
    }

    editor.chain().focus().setNodeSelection(tablePos).updateAttributes('table', {
      style,
      width: tableWidth,
    }).run();
  };

  return (
    <ModalOverlay onBackdropClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-lg font-medium text-slate-800">表格格式设置</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('border')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'border' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            边框
          </button>
          <button
            onClick={() => setActiveTab('background')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'background' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            背景色
          </button>
          <button
            onClick={() => setActiveTab('align')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'align' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            对齐
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'table' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            表格
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4">
          {activeTab === 'border' && (
            <div className="space-y-4">
              {/* 边框位置 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">边框位置</label>
                <div className="flex gap-2">
                  <button onClick={() => applyBorder('all')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <Square className="w-5 h-5 mb-1 border-2 border-current" />
                    <span className="text-xs">全部</span>
                  </button>
                  <button onClick={() => applyBorder('top')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <div className="w-5 h-5 mb-1 border-t-2 border-current" />
                    <span className="text-xs">上</span>
                  </button>
                  <button onClick={() => applyBorder('bottom')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <div className="w-5 h-5 mb-1 border-b-2 border-current" />
                    <span className="text-xs">下</span>
                  </button>
                  <button onClick={() => applyBorder('left')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <div className="w-5 h-5 mb-1 border-l-2 border-current" />
                    <span className="text-xs">左</span>
                  </button>
                  <button onClick={() => applyBorder('right')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <div className="w-5 h-5 mb-1 border-r-2 border-current" />
                    <span className="text-xs">右</span>
                  </button>
                  <button onClick={() => applyBorder('none')} className="flex flex-col items-center p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                    <Minus className="w-5 h-5 mb-1" />
                    <span className="text-xs">无</span>
                  </button>
                </div>
              </div>

              {/* 边框样式 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">边框样式</label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value)}
                  className="no-saas-select w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                >
                  {borderStyles.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* 边框粗细 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">边框粗细</label>
                <div className="flex gap-2">
                  {borderWidths.map((w) => (
                    <button
                      key={w.value}
                      onClick={() => setBorderWidth(w.value)}
                      className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                        borderWidth === w.value ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 边框颜色 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">边框颜色</label>
                <div className="grid grid-cols-9 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setBorderColor(color)}
                      className={`w-6 h-6 rounded border ${borderColor === color ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-200'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* 打印时不显示边框（仅屏幕显示） */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <input
                  id="screen-only-border"
                  type="checkbox"
                  checked={screenOnlyBorder}
                  onChange={toggleScreenOnlyBorder}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="screen-only-border" className="text-sm text-slate-700 cursor-pointer">
                  打印时不显示边框（仅屏幕显示编辑参考线）
                </label>
              </div>
            </div>
          )}

          {activeTab === 'background' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">背景颜色</label>
                <div className="grid grid-cols-9 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setBgColor(color)}
                      className={`w-6 h-6 rounded border ${bgColor === color ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-200'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={applyBackgroundColor}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                应用背景色
              </button>
            </div>
          )}

          {activeTab === 'align' && (
            <div className="space-y-4">
              {/* 垂直对齐 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">垂直对齐</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVerticalAlign('top')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      verticalAlign === 'top' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignStartVertical className="w-5 h-5 mb-1" />
                    <span className="text-xs">顶端</span>
                  </button>
                  <button
                    onClick={() => setVerticalAlign('middle')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      verticalAlign === 'middle' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignCenter className="w-5 h-5 mb-1" />
                    <span className="text-xs">居中</span>
                  </button>
                  <button
                    onClick={() => setVerticalAlign('bottom')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      verticalAlign === 'bottom' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignEndVertical className="w-5 h-5 mb-1" />
                    <span className="text-xs">底端</span>
                  </button>
                </div>
              </div>

              {/* 水平对齐 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">水平对齐</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHorizontalAlign('left')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      horizontalAlign === 'left' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignLeft className="w-5 h-5 mb-1" />
                    <span className="text-xs">左对齐</span>
                  </button>
                  <button
                    onClick={() => setHorizontalAlign('center')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      horizontalAlign === 'center' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignCenter className="w-5 h-5 mb-1" />
                    <span className="text-xs">居中</span>
                  </button>
                  <button
                    onClick={() => setHorizontalAlign('right')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      horizontalAlign === 'right' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignRight className="w-5 h-5 mb-1" />
                    <span className="text-xs">右对齐</span>
                  </button>
                </div>
              </div>

              <button
                onClick={applyAlignment}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                应用对齐
              </button>
            </div>
          )}

          {activeTab === 'table' && (
            <div className="space-y-4">
              {/* 表格宽度 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">表格宽度</label>
                <div className="flex gap-2">
                  {['100%', '80%', '60%', '520px', '420px'].map((w) => (
                    <button
                      key={w}
                      onClick={() => setTableWidth(w)}
                      className={`px-3 py-1.5 text-sm border rounded transition-colors ${
                        tableWidth === w ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={tableWidth}
                  onChange={(e) => setTableWidth(e.target.value)}
                  placeholder="自定义宽度，如 500px 或 80%"
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              {/* 表格对齐 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">表格对齐</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTableAlign('left')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      tableAlign === 'left' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignLeft className="w-5 h-5 mb-1" />
                    <span className="text-xs">左对齐</span>
                  </button>
                  <button
                    onClick={() => setTableAlign('center')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      tableAlign === 'center' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignCenter className="w-5 h-5 mb-1" />
                    <span className="text-xs">居中</span>
                  </button>
                  <button
                    onClick={() => setTableAlign('right')}
                    className={`flex flex-col items-center p-3 border rounded transition-colors ${
                      tableAlign === 'right' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlignRight className="w-5 h-5 mb-1" />
                    <span className="text-xs">右对齐</span>
                  </button>
                </div>
              </div>

              <button
                onClick={applyTableFormat}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                应用表格格式
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
