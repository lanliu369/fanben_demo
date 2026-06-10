'use client';

import { useState, useEffect } from 'react';
import { parseDocxEnhanced } from '@/lib/docxImport/enhancedDocxParser';
import { adaptHtmlForEditor } from '@/lib/docxImport/htmlAdapter';

interface DocumentModeSwitcherProps {
  file: File | null;
  editorComponent: React.ReactNode;
  onDocumentParsed?: (result: { html: string; pageMargins?: { top: string; right: string; bottom: string; left: string } }) => void;
}

/**
 * 文档模式组件
 * 仅保留编辑模式，移除 PDF 预览
 */
export function DocumentModeSwitcher({
  file,
  editorComponent,
  onDocumentParsed,
}: DocumentModeSwitcherProps) {
  const [loading, setLoading] = useState(false);

  // 文件变化时解析 HTML
  useEffect(() => {
    if (!file) return;

    const parseDocument = async () => {
      setLoading(true);
      try {
        const docResult = await parseDocxEnhanced(file, {
          embedImages: true,
          preserveStyleIds: true,
        });
        const adaptedHtml = adaptHtmlForEditor(docResult.html, {
          convertLists: true,
          markImportedTables: true,
          normalizeImages: true,
        });
        onDocumentParsed?.({ html: adaptedHtml, pageMargins: docResult.pageMargins });
      } catch (error) {
        console.error('文档解析失败:', error);
      } finally {
        setLoading(false);
      }
    };

    parseDocument();
  }, [file, onDocumentParsed]);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">请导入文档</p>
          <p className="text-sm">支持 DOCX 格式</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部分析栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4" />
        {loading && (
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            解析中...
          </div>
        )}
      </div>

      {/* 内容区域：仅编辑模式 */}
      <div className="flex-1 overflow-hidden h-full">
        {editorComponent}
      </div>
    </div>
  );
}
