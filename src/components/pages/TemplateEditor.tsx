'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Save, FileText, Lightbulb, Bot, Link2, Plus, Search,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Template, TemplateSection, OutlineItem, TextFragment } from '@/types';
import { parseSectionsFromHTML } from '@/lib/parseSectionsFromHTML';

export { parseSectionsFromHTML };
import type { RichEditorHandle } from '@/components/editor/RichEditor';
import { mockTextFragments } from '@/lib/mockData';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';

const RichEditor = dynamic(() => import('@/components/editor/RichEditor'), { ssr: false });

interface TemplateEditorProps {
  template: Template;
  onBack: () => void;
  onSave: (template: Template) => void;
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

function buildInitialHTML(sections: TemplateSection[], depth = 0): string {
  return sections.map(s => {
    const children = s.children?.length ? buildInitialHTML(s.children, depth + 1) : '';
    const content = s.textFragmentId
      ? `<div data-text-fragment-id="${s.textFragmentId}" class="quoted-block">${s.content ?? ''}</div>`
      : (s.content ?? '');
    if (!s.title.trim()) {
      return `${content}${children}`;
    }
    const tag = depth === 0 ? 'h2' : 'h3';
    return `<${tag}>${s.title}</${tag}>${content}${children}`;
  }).join('');
}

// ─── 专项资格条件结果 ──────────────────────────────────────────────────────────

function insertHTMLToEditor(editorRef: RichEditorHandle, html: string) {
  editorRef.insertHTML(html);
}

type QualData = { performance: string; qualification: string; personnel: string; other: string; fetchedAt: string };

function QualificationResult({ data, onInsert }: { data: QualData; onInsert: (html: string) => void }) {
  const items = [
    { label: '业绩要求', value: data.performance },
    { label: '资质要求', value: data.qualification },
    { label: '人员要求', value: data.personnel },
    { label: '其他要求', value: data.other },
  ];
  const html = items.map(i => `<p><strong>${i.label}：</strong>${i.value}</p>`).join('');
  return (
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-2.5 py-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-blue-700">专项资格条件</span>
        <button
          onClick={() => onInsert(html)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          插入正文
        </button>
      </div>
      <div className="p-2.5 space-y-2 select-text">
        {items.map(item => (
          <div key={item.label}>
            <span className="text-xs font-medium text-slate-700">{item.label}：</span>
            <span className="text-xs text-slate-600">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="px-2.5 py-1.5 border-t border-blue-100 text-xs text-slate-400">
        获取时间：{data.fetchedAt}
      </div>
    </div>
  );
}

// ─── 大纲导航项 ───────────────────────────────────────────────────────────────

function OutlineNavItem({ item, isActive, onSelect }: {
  item: OutlineItem;
  isActive: boolean;
  onSelect: (pos: number) => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg py-1.5 cursor-pointer transition-colors ${
        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
      style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px`, paddingRight: '8px' }}
      onClick={() => onSelect(item.pos)}
    >
      <span className="flex-1 text-xs truncate">{item.text || '（无标题）'}</span>
    </div>
  );
}

// ─── 文本片段卡片（含预览）────────────────────────────────────────────────────

function TextFragmentCard({ fragment, onInsert }: {
  fragment: TextFragment;
  onInsert: (html: string) => void;
}) {
  const [previewing, setPreviewing] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-2.5 bg-slate-50">
        <div className="text-xs font-medium text-slate-800">{fragment.name}</div>
        {fragment.description && (
          <div className="text-xs text-slate-500 mt-0.5">{fragment.description}</div>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={() => setPreviewing(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {previewing ? '收起预览' : '预览'}
          </button>
          <button
            onClick={() => onInsert(fragment.content)}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            插入正文
          </button>
        </div>
      </div>
      {previewing && (
        <div
          className="px-3 py-2.5 max-h-64 overflow-y-auto border-t border-slate-200 bg-white text-xs text-slate-700 ProseMirror"
          dangerouslySetInnerHTML={{ __html: fragment.content }}
        />
      )}
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function TemplateEditor({ template: initialTemplate, onBack, onSave }: TemplateEditorProps) {
  const [rightTab, setRightTab] = useState<RightTab>('variables');
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [variables, setVariables] = useState<Variable[]>(INITIAL_VARIABLES);
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarCategory, setNewVarCategory] = useState('基本信息');
  const [qualificationData, setQualificationData] = useState<{
    performance: string;
    qualification: string;
    personnel: string;
    other: string;
    fetchedAt: string;
  } | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [textSearchQuery, setTextSearchQuery] = useState('');

  const editorRef = useRef<RichEditorHandle>(null);

  // 只在 mount 时计算一次初始 HTML
  const initialHTML = useMemo(() => buildInitialHTML(initialTemplate.sections), [initialTemplate.sections]);

  // 按分类分组变量
  const varByCategory = useMemo(() => {
    return variables.reduce<Record<string, Variable[]>>((acc, v) => {
      (acc[v.category] ??= []).push(v);
      return acc;
    }, {});
  }, [variables]);

  const handleOutlineChange = useCallback((o: OutlineItem[]) => setOutline(o), []);

  const handleSelectOutlineItem = useCallback((pos: number) => {
    setActivePos(pos);
    editorRef.current?.scrollToPos(pos);
  }, []);

  const handleAddSection = useCallback(() => editorRef.current?.insertHeading(2), []);



  const handleSave = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? '';
    const sections = parseSectionsFromHTML(html, initialTemplate.id);
    onSave({ ...initialTemplate, updatedAt: new Date().toISOString().split('T')[0], sections });
  }, [initialTemplate, onSave]);

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
    // 模拟获取专项资格条件
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
    // 模拟流式输出
    await new Promise(r => setTimeout(r, 600));
    const mockAnswers: Record<string, string> = {
      default: `针对您的问题「${q}」，以下是范本编写建议：\n\n一、明确条款目的\n在起草相关条款时，应首先明确该条款的核心目的，确保语言表述准确、无歧义，避免因措辞模糊引发争议。\n\n二、参考法规依据\n建议参照《政府采购法》及其实施条例、《招标投标法》等相关法律法规，确保条款合规。\n\n三、结合项目特点\n根据本项目的品类特性和采购需求，适当细化技术要求和评分标准，提升范本的针对性和可操作性。`,
    };
    const answer = mockAnswers[q] ?? mockAnswers.default;
    // 逐字输出效果
    let i = 0;
    const timer = setInterval(() => {
      i += 4;
      setAiAnswer(answer.slice(0, i));
      if (i >= answer.length) clearInterval(timer);
    }, 20);
    setAiLoading(false);
  }, [aiQuestion]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{initialTemplate.name}</h1>
            <p className="text-xs text-slate-500">版本 {initialTemplate.version}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          保存
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Outline Navigation */}
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 editor-left-nav">
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-600">章节导航</span>
            <button
              onClick={handleAddSection}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
              title="添加章节"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {outline.map((item, i) => (
              <OutlineNavItem
                key={`${item.pos}-${i}`}
                item={item}
                isActive={activePos === item.pos}
                onSelect={handleSelectOutlineItem}
              />
            ))}
            {outline.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-3">暂无章节，点击 + 添加</p>
            )}
          </div>
        </div>

        {/* Center: Rich Editor */}
        <div className="flex-1 overflow-hidden">
          <RichEditor
            ref={editorRef}
            content={initialHTML}
            templateName={initialTemplate.name}
            onOutlineChange={handleOutlineChange}
          />
        </div>

        {/* Right: vertical tabs */}
        <div className="flex bg-white border-l border-slate-200 shrink-0 editor-right-panel">
          <div className="w-12 border-r border-slate-100 flex flex-col items-center py-3 gap-1">
            {RIGHT_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                title={tab.label}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  rightTab === tab.key
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {tab.icon}
              </button>
            ))}
          </div>
          <div className="w-64 overflow-y-auto">
            <div className="px-3 py-3 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-700">
                {RIGHT_TABS.find(t => t.key === rightTab)?.label}
              </span>
            </div>
            <div className="p-3">
              {rightTab === 'variables' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">点击变量名称插入到文档中</p>
                    <button
                      onClick={() => setShowAddVar(v => !v)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                      title="添加变量"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {showAddVar && (
                    <div className="space-y-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <input
                        placeholder="变量名（英文大写）"
                        value={newVarName}
                        onChange={e => setNewVarName(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                      />
                      <input
                        placeholder="显示标签（中文）"
                        value={newVarLabel}
                        onChange={e => setNewVarLabel(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                      />
                      <input
                        placeholder="分类（如：基本信息）"
                        value={newVarCategory}
                        onChange={e => setNewVarCategory(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAddVariable}
                          disabled={!newVarName.trim() || !newVarLabel.trim()}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs rounded transition-colors"
                        >
                          确认添加
                        </button>
                        <button
                          onClick={() => setShowAddVar(false)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                  {Object.entries(varByCategory).map(([cat, vars]) => (
                    <div key={cat}>
                      <div className="text-xs font-medium text-slate-600 mb-1.5">{cat}</div>
                      <div className="space-y-1">
                        {vars.map(v => (
                          <button
                            key={v.id}
                            className="w-full text-left px-2.5 py-2 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            onClick={() => editorRef.current?.insertVariable(v.name, v.label)}
                          >
                            <div className="text-xs font-mono text-blue-600">{`{{${v.name}}}`}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{v.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {rightTab === 'qualifications' && (
                <div className="space-y-3">
                  <button
                    onClick={handleFetchQualifications}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    获取专项资格条件
                  </button>
                  {qualificationData && (
                    <QualificationResult
                      data={qualificationData}
                      onInsert={(html) => editorRef.current && insertHTMLToEditor(editorRef.current, html)}
                    />
                  )}
                </div>
              )}
              {rightTab === 'ai' && (
                <div className="flex flex-col gap-3">
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-slate-600">
                    向 AI 助手提问，获取范本编写建议
                  </div>
                  <textarea
                    placeholder="输入您的问题，例如：如何编写评标办法条款？"
                    rows={4}
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAskAI();
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={handleAskAI}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {aiLoading ? (
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                    {aiLoading ? '思考中...' : '发送（⌘Enter）'}
                  </button>
                  {aiAnswer && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-2.5 py-1.5 flex items-center justify-between border-b border-slate-200">
                        <span className="text-xs font-medium text-slate-600">AI 回答</span>
                        <button
                          onClick={() => editorRef.current?.insertHTML(
                            aiAnswer.split('\n').filter(Boolean).map(line =>
                              line.startsWith('一、') || line.startsWith('二、') || line.startsWith('三、')
                                ? `<p><strong>${line}</strong></p>`
                                : `<p>${line}</p>`
                            ).join('')
                          )}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          插入正文
                        </button>
                      </div>
                      <div className="p-2.5 text-xs text-slate-700 whitespace-pre-wrap select-text leading-relaxed max-h-64 overflow-y-auto">
                        {aiAnswer}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {rightTab === 'textLinks' && (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      placeholder="搜索文本片段..."
                      value={textSearchQuery}
                      onChange={e => setTextSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  {sortByCreatedAtDesc(
                    mockTextFragments.filter(
                      (t) =>
                        t.name.includes(textSearchQuery) ||
                        (t.description ?? '').includes(textSearchQuery),
                    ),
                  ).map(t => (
                      <TextFragmentCard
                        key={t.id}
                        fragment={t}
                        onInsert={(html) => editorRef.current?.insertQuotedBlock(html, t.id)}
                      />
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
