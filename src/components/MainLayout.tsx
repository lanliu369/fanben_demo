'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AppShellContext } from '@/contexts/AppShellContext';
import {
  LayoutDashboard,
  FolderTree,
  AlignLeft,
  FileEdit,
  FileCheck,
  FolderKanban,
  ShieldCheck,
  Gavel,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Brackets,
  User,
  LogOut,
} from 'lucide-react';
import type { TabKey } from '@/types';
import DashboardPage from './pages/DashboardPage';
import CategoryPage from './pages/CategoryPage';
import TextPage from './pages/TextPage';
import QualificationPage from './pages/QualificationPage';
import EvaluationPage from './pages/EvaluationPage';
import ContractClausePage from './pages/ContractClausePage';
import TemplatePage from './pages/TemplatePage';
import TemplateVariableManagementPage from './pages/TemplateVariableManagementPage';
import BidDocumentPage from './pages/BidDocumentPage';

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { key: 'dashboard', label: '数据看板', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'category', label: '品类管理', icon: <FolderTree className="w-4 h-4" /> },
  { key: 'text', label: '文本管理', icon: <AlignLeft className="w-4 h-4" /> },
  { key: 'qualification', label: '资格条件管理', icon: <ShieldCheck className="w-4 h-4" /> },
  { key: 'evaluation', label: '评标办法管理', icon: <Gavel className="w-4 h-4" /> },
  { key: 'contract-clause', label: '合同条款管理', icon: <ScrollText className="w-4 h-4" /> },
  { key: 'template-variables', label: '范本变量管理', icon: <Brackets className="w-4 h-4" /> },
  { key: 'template', label: '范本管理', icon: <FileEdit className="w-4 h-4" /> },
  { key: 'bid-document', label: '招标文件管理', icon: <FileCheck className="w-4 h-4" /> },
];

function navButtonClass(active: boolean) {
  return `w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
    active
      ? 'bg-blue-50 text-blue-600'
      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
  }`;
}

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [resourceExpanded, setResourceExpanded] = useState(true);
  const [username, setUsername] = useState<string>('用户');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const shellValue = useMemo(() => ({ setImmersive }), []);

  useEffect(() => {
    try {
      const auth = localStorage.getItem('fanben-auth');
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed.username) setUsername(parsed.username);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fanben-auth');
    window.location.href = '/login';
  };

  const resourceKeys: TabKey[] = [
    'text',
    'qualification',
    'evaluation',
    'contract-clause',
    'template-variables',
  ];
  const topTabs = tabs.filter((tab) => ['dashboard', 'category', 'template'].includes(tab.key));
  const resourceTabs = tabs.filter((tab) => resourceKeys.includes(tab.key));
  const bottomTabs = tabs.filter((tab) => ['bid-document'].includes(tab.key));
  const isResourceActive = resourceTabs.some((tab) => tab.key === activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'category':
        return <CategoryPage />;
      case 'text':
        return <TextPage moduleName="文本" moduleKey="text" />;
      case 'qualification':
        return <QualificationPage />;
      case 'evaluation':
        return <EvaluationPage />;
      case 'contract-clause':
        return <ContractClausePage />;
      case 'template-variables':
        return <TemplateVariableManagementPage />;
      case 'template':
        return <TemplatePage />;
      case 'bid-document':
        return <BidDocumentPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppShellContext.Provider value={shellValue}>
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 左侧系统导航 */}
      <aside className={`w-64 shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden ${immersive ? 'hidden' : ''}`}>
        <div className="px-5 py-5 border-b border-slate-100 shrink-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight">招标文件范本</p>
          <p className="text-xs text-slate-500 mt-0.5">编制工具平台</p>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          <div className="space-y-1 mb-1">
            {topTabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={navButtonClass(activeTab === tab.key)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setResourceExpanded((prev) => !prev)}
            className={`${navButtonClass(isResourceActive)} justify-between`}
          >
            <span className="flex items-center gap-3">
              <FolderKanban className="w-4 h-4 shrink-0" />
              资源管理
            </span>
            <span className="text-slate-400 shrink-0">
              {resourceExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          </button>

          <div
            className={`ml-4 mt-1 space-y-1 overflow-hidden transition-all ${
              resourceExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {resourceTabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={navButtonClass(activeTab === tab.key)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1 mt-1">
            {bottomTabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={navButtonClass(activeTab === tab.key)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <p className="text-[11px] text-slate-400">© 2024 招标文件平台</p>
        </div>
      </aside>

      {/* 右侧主内容 */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className={`shrink-0 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between ${immersive ? 'hidden' : ''}`}>
          <p className="text-base font-semibold text-slate-900">
            {tabs.find((t) => t.key === activeTab)?.label}
          </p>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-medium text-slate-700">{username}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-lg border border-slate-200 shadow-sm py-1 z-50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </header>

        <div className={immersive ? 'flex-1 overflow-hidden bg-white' : 'flex-1 overflow-auto bg-gray-50'}>
          <div className={immersive ? 'h-full' : 'max-w-[1600px] mx-auto px-6 py-5'}>{renderContent()}</div>
        </div>
      </main>
    </div>
    </AppShellContext.Provider>
  );
}
