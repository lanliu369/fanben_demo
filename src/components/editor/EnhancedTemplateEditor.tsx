'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Save, FileText, Lightbulb, Bot, Link2, Plus, Search, Upload, Download,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Template, TemplateSection, OutlineItem } from '@/types';
import type { RichEditorHandle } from '@/components/editor/RichEditor';
import { getMockTextFragments } from '@/lib/mockData';
import { resolveTemplateLotLevelId } from '@/lib/classification';
import { textFragmentAppliesToTemplateLot } from '@/lib/textFragmentLotScope';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import type { PageMargins } from '@/lib/docxImport/enhancedDocxParser';
import { DocumentModeSwitcher } from './DocumentModeSwitcher';
import { TemplateEditorTitleBlock } from '@/components/editor/TemplateEditorTitleBlock';
import { exportWord } from './utils/exportWord';
import { parseSectionsFromHTML } from '@/lib/parseSectionsFromHTML';

export { parseSectionsFromHTML };

const RichEditor = dynamic(() => import('@/components/editor/RichEditor'), { ssr: false });

interface EnhancedTemplateEditorProps {
  template: Template;
  onBack: () => void;
  onSave: (template: Template) => void;
  initialFile?: File | null;
}

type RightTab = 'variables' | 'qualifications' | 'ai' | 'textLinks';

const RIGHT_TABS: { key: RightTab; icon: React.ReactNode; label: string }[] = [
  { key: 'variables',      icon: <FileText className="w-4 h-4" />,   label: '变量库' },
  { key: 'qualifications', icon: <Lightbulb className="w-4 h-4" />,  label: '资格条件' },
  { key: 'ai',             icon: <Bot className="w-4 h-4" />,        label: 'AI助手' },
  { key: 'textLinks',      icon: <Link2 className="w-4 h-4" />,      label: '文本关联' },
];

const INITIAL_VARIABLES = [
  { id: 'v1', name: 'BASIC_PROJECT_NAME',    label: '项目名称',     category: '基本信息' },
  { id: 'v2', name: 'BASIC_TENDERER',        label: '招标人',       category: '基本信息' },
  { id: 'v3', name: 'BASIC_AGENT',           label: '招标代理机构', category: '基本信息' },
  { id: 'v4', name: 'BASIC_BUDGET',          label: '项目预算',     category: '基本信息' },
  { id: 'v5', name: 'TIME_BID_DEADLINE',     label: '投标截止时间', category: '时间信息' },
  { id: 'v6', name: 'TIME_OPENING',          label: '开标时间',     category: '时间信息' },
  { id: 'v7', name: 'QUAL_REGISTERED_CAP',   label: '注册资本',     category: '资格条件' },
  { id: 'v8', name: 'QUAL_SIMILAR_PROJECTS', label: '类似项目业绩', category: '资格条件' },
];

type Variable = typeof INITIAL_VARIABLES[number];

type QualData = { performance: string; qualification: string; personnel: string; other: string; fetchedAt: string };

function QualificationResult({ data, onInsert }: { data: QualData; onInsert: (html: string) => void }) {
  const items = [
    { label: '业绩要求', value: data.performance },
    { label: '资质要求', value: data.qualification },
    { label: '人员要求', value: data.personnel },
    { label: '其他要求', value: data.other },
  ];
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">更新时间: {data.fetchedAt}</div>
      {items.map((it) => (
        <div key={it.label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium text-slate-700">{it.label}</div>
            <button
              type="button"
              onClick={() => onInsert(`<p>${it.value}</p>`)}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              插入
            </button>
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function EnhancedTemplateEditor({ template, onBack, onSave, initialFile }: EnhancedTemplateEditorProps) {
  const initialTemplate = useMemo(() => template, [template]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('variables');
  const [variables, setVariables] = useState<Variable[]>(INITIAL_VARIABLES);
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarCategory, setNewVarCategory] = useState('');
  const [qualificationData, setQualificationData] = useState<QualData | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [textFragmentSearch, setTextFragmentSearch] = useState('');
  const [importedFile, setImportedFile] = useState<File | null>(initialFile || null);
  const [editorHtml, setEditorHtml] = useState(() => {
    if (initialFile) return '';
    if (initialTemplate.sections && initialTemplate.sections.length > 0) {
      const convertSection = (section: TemplateSection): string => {
        const headingHtml = section.title ? `<h${section.level}>${section.title}</h${section.level}>` : '';
        const contentHtml = section.content || '';
        const childrenHtml = section.children?.map(convertSection).join('') || '';
        return headingHtml + contentHtml + childrenHtml;
      };
      return initialTemplate.sections.map(convertSection).join('');
    }
    return '';
  });
  const [pageMargins, setPageMargins] = useState<PageMargins | undefined>(undefined);

  const editorRef = useRef<RichEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOutlineChange = useCallback((items: OutlineItem[]) => {
    setOutline(items);
  }, []);

  const handleOutlineClick = useCallback((pos: number) => {
    setActivePos(pos);
    editorRef.current?.scrollToPos(pos);
  }, []);

  const handleAddSection = useCallback(() => editorRef.current?.insertHeading(2), []);

  const handleImportDocx = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedFile(file);
  }, []);

  const handleDocumentParsed = useCallback((result: { html: string; pageMargins?: { top: string; right: string; bottom: string; left: string } }) => {
    // 避免重复设置：只在编辑器内容为空时才插入
    const currentHtml = editorRef.current?.getHTML() ?? '';
    if (!currentHtml || currentHtml === '<p></p>') {
      setEditorHtml(result.html);
      setPageMargins(result.pageMargins);
      editorRef.current?.insertHTML(result.html);
    }
  }, []);

  const handleSave = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? '';
    const sections = parseSectionsFromHTML(html, initialTemplate.id);
    onSave({ ...initialTemplate, updatedAt: new Date().toISOString().split('T')[0], sections });
  }, [initialTemplate, onSave]);

  const handleExport = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? '';
    await exportWord(html, initialTemplate.name);
  }, [initialTemplate.name]);

  const handleAddVariable = useCallback(() => {
    const name = newVarName.trim().toUpperCase().replace(/\s+/g, '_');
    const label = newVarLabel.trim();
    const category = newVarCategory.trim() || '基本信息';
    if (!name || !label) return;
    setVariables(prev => [...prev, { id: `v_${Date.now()}`, name, label, category }]);
    setNewVarName('');
    setNewVarLabel('');
    setShowAddVar(false);
  }, [newVarName, newVarLabel, newVarCategory]);

  const handleFetchQualifications = useCallback(() => {
    setQualificationData({
      performance: '近 3 年内完成合同金额 500 万元及以上的同类工程施工项目至少 2 个，并提供合同及验收证明。',
      qualification: '具备电力工程施工总承包二级及以上资质，并在有效期内。',
      personnel: '项目经理须具备一级建造师（机电工程）执业资格，且近 3 年无不良行为记录。',
      other: '投标人须在中国境内合法注册，注册资本不低于人民币 1000 万元，且财务状况良好。',
      fetchedAt: new Date().toLocaleString('zh-CN'),
    });
  }, []);

  const handleAskAI = useCallback(async () => {
    const q = aiQuestion.trim();
    if (!q) return;
    setAiLoading(true);
    setAiAnswer('');
    await new Promise(r => setTimeout(r, 600));
    const mockAnswers: Record<string, string> = {
      default: `针对您的问题「${q}」，以下是范本编写建议：\n\n一、明确条款目的\n在起草相关条款时，应首先明确该条款的核心目的，确保语言表述准确、无歧义，避免因措辞模糊引发争议。\n\n二、参考法规依据\n建议参照《政府采购法》及其实施条例、《招标投标法》等相关法律法规，确保条款合规。\n\n三、结合项目特点\n根据本项目的品类特性和采购需求，适当细化技术要求和评分标准，提升范本的针对性和可操作性。`,
    };
    const answer = mockAnswers[q] ?? mockAnswers.default;
    let i = 0;
    const timer = setInterval(() => {
      i += 4;
      setAiAnswer(answer.slice(0, i));
      if (i >= answer.length) clearInterval(timer);
    }, 20);
    setAiLoading(false);
  }, [aiQuestion]);

  const textFragments = useMemo(() => {
    const list = getMockTextFragments().filter((f) =>
      textFragmentAppliesToTemplateLot(f, resolveTemplateLotLevelId(initialTemplate)),
    );
    const filtered = !textFragmentSearch.trim()
      ? list
      : list.filter(
          (f) =>
            f.name.toLowerCase().includes(textFragmentSearch.toLowerCase()) ||
            f.content.toLowerCase().includes(textFragmentSearch.toLowerCase()),
        );
    return sortByCreatedAtDesc(filtered);
  }, [textFragmentSearch, initialTemplate.lotLevelId]);

  const editorComponent = (
    <RichEditor
      ref={editorRef}
      content={editorHtml}
      onChange={(html) => setEditorHtml(html)}
      templateName={initialTemplate.name}
      onOutlineChange={handleOutlineChange}
      pageMargins={pageMargins}
    />
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="shrink-0 min-h-14 py-2 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <TemplateEditorTitleBlock template={initialTemplate} editorLabel="增强版在线编辑" />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleImportDocx}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
          <button
            onClick={handleAddSection}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加章节
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            导出Word
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Outline */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-3 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-900">章节导航</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {outline.length === 0 ? (
              <div className="text-xs text-slate-400 p-2">暂无章节</div>
            ) : (
              <div className="space-y-1">
                {outline.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOutlineClick(item.pos)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm truncate transition-colors ${
                      activePos === item.pos
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center - Editor with Mode Switcher */}
        <div className="flex-1 flex flex-col min-w-0">
          <DocumentModeSwitcher
            file={importedFile}
            editorComponent={editorComponent}
            onDocumentParsed={handleDocumentParsed}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            {RIGHT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === 'variables' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-900">变量库</h4>
                  <button
                    onClick={() => setShowAddVar(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    添加
                  </button>
                </div>
                {showAddVar && (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="变量名 (如: PROJECT_NAME)"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="显示名称"
                      value={newVarLabel}
                      onChange={(e) => setNewVarLabel(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="分类"
                      value={newVarCategory}
                      onChange={(e) => setNewVarCategory(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddVariable}
                        className="flex-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setShowAddVar(false)}
                        className="flex-1 text-xs px-2 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {variables.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => editorRef.current?.insertVariable(v.name, v.label)}
                      className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-700">{v.label}</div>
                      <div className="text-xs text-slate-500">{v.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rightTab === 'qualifications' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-900">专项资格条件</h4>
                  <button
                    onClick={handleFetchQualifications}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    获取
                  </button>
                </div>
                {qualificationData && (
                  <QualificationResult
                    data={qualificationData}
                    onInsert={(html) => editorRef.current?.insertHTML(html)}
                  />
                )}
              </div>
            )}

            {rightTab === 'ai' && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">AI 助手</h4>
                <textarea
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="输入您的问题..."
                  className="w-full h-24 px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none"
                />
                <button
                  onClick={handleAskAI}
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {aiLoading ? '思考中...' : '提问'}
                </button>
                {aiAnswer && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{aiAnswer}</div>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'textLinks' && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">文本关联</h4>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索文本片段..."
                    value={textFragmentSearch}
                    onChange={(e) => setTextFragmentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {textFragments.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => editorRef.current?.insertQuotedBlock(f.content, f.id)}
                      className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-700 truncate">{f.name}</div>
                      {f.description ? (
                        <div className="text-xs text-slate-500 truncate">{f.description}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
