'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { FileText, FolderTree, FileEdit } from 'lucide-react';
import {
  getMockBidDocuments,
  getMockTemplates,
  getMockTextFragments,
} from '@/lib/mockData';
import {
  getClassificationStats,
  getClassificationStoreSsrSnapshot,
} from '@/lib/classification';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { HintPanel } from '@/components/ui/HintPanel';
import type { TemplateSection } from '@/types';

function toTime(date?: string) {
  if (!date) return 0;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function collectTextIds(sections: TemplateSection[], set = new Set<string>()) {
  sections.forEach((section) => {
    if (section.textFragmentId) {
      set.add(section.textFragmentId);
    }
    if (section.children?.length) {
      collectTextIds(section.children, set);
    }
  });
  return set;
}

export default function DashboardPage() {
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    startTransition(() => {
      setStorageReady(true);
    });
  }, []);

  const classificationStats = useMemo(
    () =>
      storageReady
        ? getClassificationStats()
        : getClassificationStats(getClassificationStoreSsrSnapshot()),
    [storageReady],
  );
  const templates = useMemo(() => (storageReady ? getMockTemplates() : []), [storageReady]);
  const bidDocuments = useMemo(() => (storageReady ? getMockBidDocuments() : []), [storageReady]);
  const textFragments = useMemo(() => (storageReady ? getMockTextFragments() : []), [storageReady]);

  const metrics = useMemo(() => {
    const lotLevelCount = classificationStats.lotLevelCount;

    const publishedTemplates = templates.filter((tpl) => tpl.status === 'published').length;
    const draftTemplates = templates.filter((tpl) => tpl.status === 'draft').length;

    const completedDocs = bidDocuments.filter((doc) => doc.status === 'completed').length;
    const draftDocs = bidDocuments.filter((doc) => doc.status === 'draft').length;

    const pendingCompile = templates.filter(
      (tpl) => tpl.status === 'draft' && (tpl.editProgress ?? 0) < 100,
    );

    const textUpdatedAtMap = new Map(textFragments.map((text) => [text.id, toTime(text.updatedAt)]));
    const templatesImpactedByTextUpdate = templates.filter((tpl) => {
      const templateUpdatedAt = toTime(tpl.updatedAt);
      const textIds = collectTextIds(tpl.sections);
      for (const textId of textIds) {
        const textUpdatedAt = textUpdatedAtMap.get(textId) ?? 0;
        if (textUpdatedAt > templateUpdatedAt) {
          return true;
        }
      }
      return false;
    });

    return {
      lotLevelCount,
      publishedTemplates,
      draftTemplates,
      completedDocs,
      draftDocs,
      pendingCompile,
      templatesImpactedByTextUpdate,
    };
  }, [bidDocuments, classificationStats, templates, textFragments]);

  const stats = [
    {
      title: '标段总数',
      value: metrics.lotLevelCount,
      icon: <FolderTree className="w-6 h-6 text-blue-600" />,
      subtext: `覆盖 ${classificationStats.businessSectorCount} 个业务板块`,
      showTrendIcon: true,
      iconBgClassName: 'bg-blue-50',
    },
    {
      title: '范本总数',
      value: templates.length,
      icon: <FileEdit className="w-6 h-6 text-green-600" />,
      subtext: `已发布 ${metrics.publishedTemplates} / 草稿 ${metrics.draftTemplates}`,
      iconBgClassName: 'bg-green-50',
    },
    {
      title: '招标文件',
      value: bidDocuments.length,
      icon: <FileText className="w-6 h-6 text-orange-600" />,
      subtext: `已定稿 ${metrics.completedDocs} / 草稿 ${metrics.draftDocs}`,
      iconBgClassName: 'bg-orange-50',
    },
  ];

  const todos = [
    {
      title: '待完成范本编制',
      description:
        metrics.pendingCompile.length > 0
          ? `共有 ${metrics.pendingCompile.length} 个范本处于草稿未完成状态。`
          : '当前没有未完成编制的范本。',
      tone: (metrics.pendingCompile.length > 0 ? 'warning' : 'info') as 'warning' | 'info',
      meta: `草稿总数 ${metrics.draftTemplates}`,
    },
    {
      title: '文本更新影响',
      description:
        metrics.templatesImpactedByTextUpdate.length > 0
          ? `检测到 ${metrics.templatesImpactedByTextUpdate.length} 个范本引用了更晚更新的文本片段。`
          : '文本与范本版本保持一致，暂无更新影响。',
      tone: (metrics.templatesImpactedByTextUpdate.length > 0 ? 'warning' : 'info') as 'warning' | 'info',
      meta:
        metrics.templatesImpactedByTextUpdate.length > 0
          ? `待核对范本 ${metrics.templatesImpactedByTextUpdate.length}`
          : `已发布范本 ${metrics.publishedTemplates}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <SectionCard title="待办事项" bodyClassName="p-6 space-y-3">
        {todos.map((todo) => (
          <HintPanel key={todo.title} {...todo} />
        ))}
      </SectionCard>

      <SectionCard title="快速操作" bodyClassName="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="p-2 bg-blue-50 rounded-lg">
            <FolderTree className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">维护招采分类</p>
            <p className="text-xs text-slate-500">管理业务板块与标段主数据</p>
          </div>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="p-2 bg-purple-50 rounded-lg">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">维护资源</p>
            <p className="text-xs text-slate-500">维护文本与评标办法条款</p>
          </div>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="p-2 bg-green-50 rounded-lg">
            <FileEdit className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">编制范本</p>
            <p className="text-xs text-slate-500">基于资源条款编制范本</p>
          </div>
        </button>
      </SectionCard>
    </div>
  );
}
