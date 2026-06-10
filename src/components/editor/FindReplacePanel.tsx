'use client';

import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface FindReplacePanelProps {
  editor: Editor | null;
  onClose: () => void;
}

interface SearchResultPayload {
  results?: Array<{ from: number; to: number }>;
  currentIndex: number;
}

interface FindReplaceCommands {
  setSearchTerm?: (term: string) => void;
  getSearchResults?: () => SearchResultPayload;
  nextSearchResult?: () => void;
  previousSearchResult?: () => void;
  replaceNext?: (replacement: string) => void;
  replaceAll?: (replacement: string) => void;
}

export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const commands = editor?.commands as unknown as FindReplaceCommands | undefined;

  const runSearch = (term: string) => {
    if (!editor || !term) {
      setResultCount(0);
      setCurrentIndex(0);
      return;
    }

    // 触发搜索
    commands?.setSearchTerm?.(term);

    // 获取搜索结果
    const results = commands?.getSearchResults?.() || { results: [], currentIndex: -1 };
    setResultCount(results.results?.length || 0);
    setCurrentIndex(results.currentIndex >= 0 ? results.currentIndex + 1 : 0);
  };

  const handleNext = () => {
    if (!editor) return;
    commands?.nextSearchResult?.();
    const results = commands?.getSearchResults?.() || { currentIndex: -1 };
    setCurrentIndex(results.currentIndex >= 0 ? results.currentIndex + 1 : 0);
  };

  const handlePrevious = () => {
    if (!editor) return;
    commands?.previousSearchResult?.();
    const results = commands?.getSearchResults?.() || { currentIndex: -1 };
    setCurrentIndex(results.currentIndex >= 0 ? results.currentIndex + 1 : 0);
  };

  const handleReplace = () => {
    if (!editor) return;
    commands?.replaceNext?.(replaceText);
    // 重新搜索以更新结果
    setTimeout(() => {
      commands?.setSearchTerm?.(findText);
    }, 10);
  };

  const handleReplaceAll = () => {
    if (!editor) return;
    commands?.replaceAll?.(replaceText);
    setFindText('');
    setReplaceText('');
  };

  const handleClose = () => {
    if (editor) {
      commands?.setSearchTerm?.('');
    }
    onClose();
  };

  return (
    <div className="absolute top-full right-0 mt-1 mr-2 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20 w-80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">查找和替换</span>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          onMouseDown={(e) => e.preventDefault()}
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* 查找输入框 */}
      <div className="mb-2">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={findText}
            onChange={(e) => {
              const next = e.target.value;
              setFindText(next);
              runSearch(next);
            }}
            placeholder="查找..."
            className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handlePrevious}
            disabled={resultCount === 0}
            className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onMouseDown={(e) => e.preventDefault()}
            title="上一个"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={resultCount === 0}
            className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onMouseDown={(e) => e.preventDefault()}
            title="下一个"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 min-w-[3rem] text-center">
            {resultCount > 0 ? `${currentIndex}/${resultCount}` : '0/0'}
          </span>
        </div>
      </div>

      {/* 替换输入框 */}
      <div className="mb-2">
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          placeholder="替换为..."
          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleReplace}
          disabled={resultCount === 0}
          className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onMouseDown={(e) => e.preventDefault()}
        >
          替换
        </button>
        <button
          onClick={handleReplaceAll}
          disabled={resultCount === 0}
          className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onMouseDown={(e) => e.preventDefault()}
        >
          全部替换
        </button>
      </div>
    </div>
  );
}
