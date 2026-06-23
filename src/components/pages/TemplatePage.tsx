'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, FileText, Download, X, Upload,
  ChevronDown, ChevronUp, ChevronRight, Sparkles, Loader2,
  Send, Filter, CalendarDays, RotateCcw, ClipboardList, Copy, Settings,
} from 'lucide-react';
import mammoth from 'mammoth';
import { asBlob } from 'html-docx-js-typescript';
import type { Template, Framework, TemplateSection, Chapter } from '@/types';
import {
  getLotLevelPath,
  getMockTemplates,
  getMockTextFragments,
  setMockTemplates,
  softDeleteTemplate,
  duplicateMockTemplate,
} from '@/lib/mockData';
import { getClassificationStore, templateFieldsFromLotPath } from '@/lib/classification';
import { seedLotIds } from '@/lib/classification/seed-lot-ids';
import {
  LotCascadeFields,
  emptyLotCascade,
  lotCascadeFromLotId,
  type LotCascadeValue,
} from '@/components/classification/LotCascadeFields';
import {
  TemplateLotMetaFields,
  emptyTemplateLotMeta,
  type TemplateLotMetaValue,
} from '@/components/classification/TemplateLotMetaFields';
import { appendDataAudit, getMockActor, getTemplateAuditLogs } from '@/lib/dataAudit';
import { OperationLogDialog } from '@/components/ui/OperationLogDialog';
import { systemUi } from '@/lib/systemUi';
import { FormSelect } from '@/components/ui/FormSelect';
import { resolveSectionRichHtml } from '@/lib/resolveTemplateSectionHtml';
import { parseSectionsFromHTML } from './TemplateEditor';
import { WpsTemplateEditor } from '@/components/editor/WpsTemplateEditor';
import { saveTemplateDocxCache } from '@/lib/templateDocxCache';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { useGlobalLoading } from '@/components/ui/GlobalLoading';
import { useAppShell } from '@/contexts/AppShellContext';
import { previewTableText } from '@/lib/previewText';
import { parseDocxEnhanced } from '@/lib/docxImport/enhancedDocxParser';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createPageBreak(doc: Document): HTMLDivElement {
  const div = doc.createElement('div');
  div.className = 'page-break';
  return div;
}

function postProcessMammothHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const firstHeading = body.querySelector('h1, h2, h3, h4, h5, h6');
  const preHeadingParagraphs: HTMLParagraphElement[] = [];

  if (firstHeading) {
    let node: Node | null = body.firstChild;
    while (node && node !== firstHeading) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'P') {
        preHeadingParagraphs.push(node as HTMLParagraphElement);
      }
      node = node.nextSibling;
    }
  } else {
    preHeadingParagraphs.push(...Array.from(body.querySelectorAll(':scope > p')) as HTMLParagraphElement[]);
  }

  preHeadingParagraphs.forEach((p) => {
    const text = p.textContent?.trim() || '';

    // 目录标题
    if (/^目\s*录$/.test(text)) {
      p.classList.add('toc-heading');
      p.setAttribute('style', 'text-align:center;text-indent:0;');
      return;
    }

    // 目录条目
    const tocLink = p.querySelector('a[href^="#_Toc"]');
    if (tocLink && p.children.length === 1 && tocLink.parentElement === p) {
      const linkText = tocLink.textContent || '';
      const parts = linkText.split('\t');
      if (parts.length >= 2) {
        const title = parts.slice(0, -1).join('\t').trim();
        const page = parts[parts.length - 1].trim();
        tocLink.innerHTML = `<span class="toc-title">${escapeHtml(title)}</span><span class="toc-dots"></span><span class="toc-page">${escapeHtml(page)}</span>`;
      }
      p.classList.add('toc-entry');
      return;
    }

    // 招标编号 右对齐
    if (/招标编号/.test(text)) {
      p.classList.add('cover-bid-no');
      p.style.setProperty('text-align', 'right', 'important');
      p.style.setProperty('text-indent', '0', 'important');
      p.style.setProperty('margin-top', '60px', 'important');
      return;
    }

    // 公司名称（封面大字）
    if (/国家电力投资集团有限公司/.test(text)) {
      p.setAttribute('style', 'text-align:center;text-indent:0;margin-top:120px;');
      const strong = p.querySelector('strong, b');
      if (strong) {
        strong.outerHTML = `<span style="font-size:34.7px;font-weight:700;font-family:SimHei,黑体,sans-serif;">${strong.innerHTML}</span>`;
      }
      return;
    }

    // 文档名称（封面大字）
    if (/设备采购招标文件范本/.test(text)) {
      p.setAttribute('style', 'text-align:center;text-indent:0;');
      const strong = p.querySelector('strong, b');
      if (strong) {
        strong.outerHTML = `<span style="font-size:34.7px;font-weight:700;font-family:SimHei,黑体,sans-serif;">${strong.innerHTML}</span>`;
      }
      return;
    }

    // 版本说明
    if (/基础类.*年版/.test(text)) {
      p.setAttribute('style', 'text-align:center;text-indent:0;margin-bottom:80px;');
      const strong = p.querySelector('strong, b');
      if (strong) {
        strong.outerHTML = `<span style="font-size:24px;font-weight:700;font-family:SimHei,黑体,sans-serif;">${strong.innerHTML}</span>`;
      }
      return;
    }

    // 日期（封面底部）
    if (/20\s*年\s*月|20__年__月/.test(text)) {
      p.innerHTML = '<span style="display:inline-block;border-bottom:1px solid #000;padding:0 48px;line-height:1.4;">20&nbsp;&nbsp;&nbsp;&nbsp;年&nbsp;&nbsp;&nbsp;&nbsp;月</span>';
      p.setAttribute('style', 'text-align:center;text-indent:0;margin-top:80px;');
      return;
    }

    // 使用说明：只保留居中，不修改字号
    if (/使用说明/.test(text)) {
      p.classList.add('usage-title');
      p.setAttribute('style', 'text-align:center;text-indent:0;');
      return;
    }

    // 封面/使用说明等短标题段落：只包含格式标签且无普通文本节点
    const onlyFormatting = Array.from(p.childNodes).every((n) => {
      if (n.nodeType === Node.TEXT_NODE) return !n.textContent?.trim();
      if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = (n as Element).tagName.toLowerCase();
        return ['strong', 'b', 'a', 'img', 'br', 'span', 'em', 'i', 'u'].includes(tag);
      }
      return false;
    });
    if (onlyFormatting && text.length > 0 && text.length <= 60 && !/使用说明/.test(text)) {
      p.classList.add('cover-text');
      p.setAttribute('style', 'text-align:center;text-indent:0;');
    }
  });

  // 封面图片统一处理：设置 width 属性（Tiptap Image 扩展会保留）
  const coverImg = body.querySelector('img[alt*="微信图片"]') as HTMLImageElement | null;
  if (coverImg) {
    coverImg.setAttribute('width', '180');
    coverImg.removeAttribute('style');
    const imgParent = coverImg.parentElement;
    if (imgParent && imgParent.tagName === 'P') {
      imgParent.setAttribute('style', 'text-align:center;text-indent:0;');
    }
  }

  // 封面表格（第一个 heading 之前的 table）保留 table，但注入虚线边框样式
  const coverTable = firstHeading
    ? (Array.from(body.children).find((el) => el.tagName === 'TABLE' && firstHeading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) as HTMLTableElement | undefined)
    : body.querySelector('table') || undefined;
  if (coverTable) {
    coverTable.classList.add('cover-table', 'screen-only-border');
    coverTable.querySelectorAll('td, th').forEach((cell) => {
      cell.setAttribute('style', 'padding:8px 0;text-align:center;vertical-align:middle;');
    });
  }

  // 使用说明前插入分页符
  const usageTitle = body.querySelector('p.usage-title');
  if (usageTitle) {
    body.insertBefore(createPageBreak(doc), usageTitle);
  }

  // 在目录标题前插入分页符（如果前面还有内容）
  const tocHeading = body.querySelector('p.toc-heading');
  if (tocHeading && tocHeading.previousElementSibling) {
    body.insertBefore(createPageBreak(doc), tocHeading);
  }

  // 在每个 h1 前面插入分页符（如果不是第一个子元素）
  const h1s = Array.from(body.querySelectorAll('h1'));
  h1s.forEach((h1, index) => {
    if (index === 0 && !h1.previousElementSibling) return;
    body.insertBefore(createPageBreak(doc), h1);
  });

  return body.innerHTML;
}

function sanitizeExportBodyHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="export-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('export-root');
  if (!root) {
    return html;
  }

  const normalizeHighlightBlock = (block: HTMLElement) => {
    block.removeAttribute('data-oo-highlight-block');
    block.style.removeProperty('background');
    block.style.removeProperty('background-color');
    block.style.removeProperty('border');
    block.style.removeProperty('border-left');
    block.style.removeProperty('padding');
    block.style.removeProperty('margin');
    block.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.removeProperty('background');
      el.style.removeProperty('background-color');
      el.style.removeProperty('border');
      el.style.removeProperty('border-left');
      el.style.removeProperty('color');
    });
  };

  // 新版：显式标记的资源高亮块
  root.querySelectorAll<HTMLElement>('[data-oo-highlight-block="1"]').forEach((block) => {
    normalizeHighlightBlock(block);
  });

  // 兼容旧版：按内联样式特征识别高亮块并去样式
  root.querySelectorAll<HTMLElement>('div[style]').forEach((divEl) => {
    const styleText = (divEl.getAttribute('style') ?? '').toLowerCase().replace(/\s+/g, '');
    const looksLikeHighlightBlock =
      styleText.includes('background:#fff8db') ||
      styleText.includes('background-color:#fff8db') ||
      styleText.includes('border-left:4pxsolid#f59e0b') ||
      styleText.includes('border:1pxsolid#f6d88f');
    if (looksLikeHighlightBlock) {
      normalizeHighlightBlock(divEl);
    }
  });

  const separatorLineRe = /^\s*[─—-]{3,}\s*$/;
  // 去掉单独成段的分隔线（──── / ----）
  root.querySelectorAll<HTMLElement>('p, div, li').forEach((el) => {
    const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    if (separatorLineRe.test(text)) {
      el.remove();
    }
  });

  // 去掉段内通过 <br> 插入的分隔线行
  root.querySelectorAll<HTMLElement>('p, div').forEach((el) => {
    const html = el.innerHTML;
    if (!html || !/─|—|-/.test(html)) {
      return;
    }
    const cleaned = html
      .replace(/(?:^|<br\s*\/?>)\s*[─—-]{3,}\s*(?=<br\s*\/?>|$)/gi, '')
      .replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>')
      .replace(/^(<br\s*\/?>)+/gi, '')
      .replace(/(<br\s*\/?>)+$/gi, '');
    if (cleaned !== html) {
      el.innerHTML = cleaned;
    }
  });

  root.querySelectorAll('table').forEach((table) => {
    const tableEl = table as HTMLTableElement;
    tableEl.removeAttribute('width');
    tableEl.style.removeProperty('width');
    tableEl.style.width = '100%';
    tableEl.style.maxWidth = '100%';
    tableEl.style.tableLayout = 'fixed';
  });

  root.querySelectorAll('td, th').forEach((cell) => {
    const cellEl = cell as HTMLElement;
    cellEl.removeAttribute('width');
    cellEl.style.removeProperty('width');
    cellEl.style.maxWidth = '0';
    cellEl.style.wordBreak = 'break-word';
    cellEl.style.whiteSpace = 'normal';
  });

  root.querySelectorAll('img').forEach((img) => {
    const imgEl = img as HTMLImageElement;
    imgEl.removeAttribute('width');
    imgEl.removeAttribute('height');
    imgEl.style.maxWidth = '100%';
    imgEl.style.height = 'auto';
  });

  return root.innerHTML;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('读取文件失败'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Mock 框架数据 ────────────────────────────────────────────────────────────

const defaultChapters = [
  { id: 'dch-1', frameworkId: 'fw-default', title: '第一章 招标公告', order: 1, level: 1, children: [] },
  { id: 'dch-2', frameworkId: 'fw-default', title: '第二章 投标人须知', order: 2, level: 1, children: [] },
  { id: 'dch-3', frameworkId: 'fw-default', title: '第三章 技术规格要求', order: 3, level: 1, children: [] },
  { id: 'dch-4', frameworkId: 'fw-default', title: '第四章 评标办法', order: 4, level: 1, children: [] },
  { id: 'dch-5', frameworkId: 'fw-default', title: '第五章 合同条款', order: 5, level: 1, children: [] },
];

const mockFrameworks: Framework[] = [
  {
    id: 'fw-1',
    name: '储能电站EPC招标框架',
    lotLevelId: seedLotIds.kxx,
    lotLevelName: '储能电站EPC',
    status: 'published',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20',
    chapters: [
      { id: 'ch-1', frameworkId: 'fw-1', title: '第一章 招标公告', order: 1, level: 1, children: [
        { id: 'ch-1-1', frameworkId: 'fw-1', title: '1.1 项目概述', order: 1, level: 2, parentId: 'ch-1' },
        { id: 'ch-1-2', frameworkId: 'fw-1', title: '1.2 资格要求', order: 2, level: 2, parentId: 'ch-1' },
      ]},
      { id: 'ch-2', frameworkId: 'fw-1', title: '第二章 投标人须知', order: 2, level: 1, children: [
        { id: 'ch-2-1', frameworkId: 'fw-1', title: '2.1 总则', order: 1, level: 2, parentId: 'ch-2' },
        { id: 'ch-2-2', frameworkId: 'fw-1', title: '2.2 投标文件要求', order: 2, level: 2, parentId: 'ch-2' },
        { id: 'ch-2-3', frameworkId: 'fw-1', title: '2.3 评标标准', order: 3, level: 2, parentId: 'ch-2' },
      ]},
      { id: 'ch-3', frameworkId: 'fw-1', title: '第三章 技术规格要求', order: 3, level: 1, children: [
        { id: 'ch-3-1', frameworkId: 'fw-1', title: '3.1 技术参数', order: 1, level: 2, parentId: 'ch-3' },
        { id: 'ch-3-2', frameworkId: 'fw-1', title: '3.2 验收标准', order: 2, level: 2, parentId: 'ch-3' },
      ]},
      { id: 'ch-4', frameworkId: 'fw-1', title: '第四章 合同条款', order: 4, level: 1, children: [] },
    ],
  },
  {
    id: 'fw-2',
    name: '光伏项目EPC工程总承包招标框架',
    lotLevelId: seedLotIds.kancha,
    lotLevelName: '光伏项目EPC工程总承包',
    status: 'published',
    createdAt: '2024-01-18',
    updatedAt: '2024-01-22',
    chapters: [
      { id: 'ch-5', frameworkId: 'fw-2', title: '第一章 项目说明', order: 1, level: 1, children: [
        { id: 'ch-5-1', frameworkId: 'fw-2', title: '1.1 项目背景', order: 1, level: 2, parentId: 'ch-5' },
        { id: 'ch-5-2', frameworkId: 'fw-2', title: '1.2 项目目标', order: 2, level: 2, parentId: 'ch-5' },
      ]},
      { id: 'ch-6', frameworkId: 'fw-2', title: '第二章 服务内容与要求', order: 2, level: 1, children: [] },
      { id: 'ch-7', frameworkId: 'fw-2', title: '第三章 技术规格要求', order: 3, level: 1, children: [] },
    ],
  },
  {
    id: 'fw-default',
    name: '通用招标框架',
    lotLevelId: '',
    lotLevelName: '通用',
    status: 'published',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    chapters: defaultChapters,
  },
];

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 无预设框架：新建范本时章节为空，由用户在金山 WebOffice 中通过标题手动搭建 */
const FW_MANUAL = 'fw-manual';

function flattenAllChapters(chapters: Chapter[]): Chapter[] {
  const out: Chapter[] = [];
  const walk = (chs: Chapter[]) => {
    chs.forEach((ch) => {
      out.push(ch);
      if (ch.children?.length) walk(ch.children);
    });
  };
  walk(chapters);
  return out;
}

function assignTemplateId(sections: TemplateSection[], templateId: string): TemplateSection[] {
  return sections.map((s) => ({
    ...s,
    templateId,
    children: s.children?.length ? assignTemplateId(s.children, templateId) : undefined,
  }));
}

function flattenLeafSections(sections: TemplateSection[]): TemplateSection[] {
  const leaves: TemplateSection[] = [];
  const walk = (items: TemplateSection[]) => {
    items.forEach((sec) => {
      if (sec.children?.length) {
        walk(sec.children);
      } else {
        leaves.push(sec);
      }
    });
  };
  walk(sections);
  return leaves;
}

function sectionHasRequiredContent(section: TemplateSection): boolean {
  const raw = section.content ?? '';
  if (!raw.trim()) {
    return false;
  }
  if (/<table[\s>]/i.test(raw)) {
    return true;
  }
  const plain = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

function calcTemplateEditProgress(template: Template): number {
  const leafSections = flattenLeafSections(template.sections);
  if (leafSections.length === 0) {
    return 0;
  }
  const doneCount = leafSections.filter(sectionHasRequiredContent).length;
  return Math.round((doneCount / leafSections.length) * 100);
}

/** 按框架树生成范本章节（含子节），与资源「绑定到某范本某节」一致 */
function buildSections(frameworkId: string, progress: number): TemplateSection[] {
  if (frameworkId === FW_MANUAL) {
    return [];
  }
  const fw = mockFrameworks.find(f => f.id === frameworkId) ?? mockFrameworks.find(f => f.id === 'fw-default')!;
  const allFlat = flattenAllChapters(fw.chapters);
  const total = Math.max(allFlat.length, 1);
  const filledCount = Math.round((progress / 100) * total);
  const filledIds = new Set(allFlat.slice(0, filledCount).map((c) => c.id));

  const mapChapter = (ch: Chapter): TemplateSection => ({
    id: `sec-${frameworkId}-${ch.id}`,
    templateId: '',
    chapterId: ch.id,
    title: ch.title,
    order: ch.order,
    level: ch.level,
    parentId: ch.parentId,
    content: filledIds.has(ch.id)
      ? `【${ch.title}】\n\n本章节内容已编辑完成，包含相关条款和要求。`
      : '',
    children: ch.children?.length ? ch.children.map(mapChapter) : undefined,
  });

  return fw.chapters.filter((ch) => ch.level === 1).map(mapChapter);
}

function suggestVersionForLot(templates: Template[], lotLevelId: string): string {
  const n = templates.filter((t) => t.lotLevelId === lotLevelId && !t.deletedAt).length;
  return `V${n + 1}.0`;
}

function makeTpl(
  id: string,
  name: string,
  lotLevelId: string,
  frameworkId: string,
  version: string,
  status: Template['status'],
  editProgress: number,
  createdAt: string,
  updatedAt: string,
  description?: string,
): Template {
  const path = lotLevelId ? getLotLevelPath(lotLevelId) : null;
  const sections = buildSections(frameworkId, editProgress);
  return {
    id,
    name,
    description,
    frameworkId,
    lotLevelId: lotLevelId || '',
    ...(path ? templateFieldsFromLotPath(path) : {}),
    version,
    status,
    editProgress,
    createdAt,
    updatedAt,
    sections: assignTemplateId(sections, id),
    variables: [],
  };
}

// ─── Mock 范本数据 ─────────────────────────────────────────────────────────────

const initialTemplates: Template[] = [
  makeTpl('tpl-1', '储能电站EPC招标范本', seedLotIds.kxx, 'fw-1', 'V1.0', 'published', 100, '2024-01-20', '2024-01-25', '适用于储能电站EPC总承包项目的标准招标范本'),
  makeTpl('tpl-2', '储能电站EPC招标范本', seedLotIds.kxx, 'fw-1', 'V2.0', 'draft', 60, '2024-02-01', '2024-02-10', '增强版，补充了更详细的技术参数要求'),
  makeTpl('tpl-3', '光伏EPC工程总承包招标范本', seedLotIds.kancha, 'fw-2', 'V1.0', 'published', 100, '2024-01-22', '2024-01-28', '适用于光伏项目EPC工程总承包招标'),
  makeTpl('tpl-4', '储能系统设备采购范本', seedLotIds.cefeng, 'fw-default', 'V1.0', 'published', 80, '2024-01-18', '2024-02-05', '储能系统设备采购通用范本'),
  makeTpl('tpl-5', '前期咨询服务范本', seedLotIds.cefeng, 'fw-default', 'V1.0', 'draft', 40, '2024-02-08', '2024-02-12'),
  makeTpl('tpl-6', '海上风电EPC工程总承包范本', seedLotIds.cbsj, 'fw-default', 'V1.0', 'published', 100, '2024-01-10', '2024-01-20', '适用于海上风电工程EPC总承包招标'),
  makeTpl('tpl-7', '光伏EPC工程总承包招标范本', seedLotIds.kancha, 'fw-default', 'V1.0', 'draft', 20, '2024-02-15', '2024-02-15'),
  makeTpl('tpl-8', '陆上风电EPC工程总承包范本', seedLotIds.kxx, 'fw-default', 'V1.0', 'published', 100, '2023-12-01', '2024-01-05', '陆上风电EPC总承包招标标准范本'),
];

// ─── AI 搜索评分 ──────────────────────────────────────────────────────────────

function scoreTemplate(query: string, t: Template): number {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    t.name,
    t.lotLevelName,
    t.businessSectorName,
    t.businessTypeDisplayName,
    t.energyType,
    t.description ?? '',
    ...t.sections.map(s => s.title),
  ].join(' ').toLowerCase();
  return tokens.reduce((n, tok) => n + (haystack.includes(tok) ? 1 : 0), 0);
}

// ─── 状态徽章 ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Template['status'] }) {
  const map = {
    draft: { cls: 'bg-slate-100 text-slate-600', label: '草稿' },
    published: { cls: 'bg-emerald-50 text-emerald-700', label: '已发布' },
  };
  const { cls, label } = map[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function TemplatePage() {
  const globalLoading = useGlobalLoading();
  const { setImmersive } = useAppShell();
  const classificationStore = useMemo(() => getClassificationStore(), []);
  const [templates, setTemplates] = useState<Template[]>(() => {
    const storedTemplates = getMockTemplates();
    if (storedTemplates.length === 0) {
      setMockTemplates(initialTemplates);
      return initialTemplates;
    }
    return storedTemplates;
  });
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingTemplateFile, setEditingTemplateFile] = useState<File | null>(null);

  useEffect(() => {
    setImmersive(!!editingTemplate);
    return () => setImmersive(false);
  }, [editingTemplate, setImmersive]);

  // 标段筛选
  const [selectedBusinessSectorId, setSelectedBusinessSectorId] = useState('');
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('');
  const [selectedLotLevelId, setSelectedLotLevelId] = useState('');
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [timeFilterCollapsed, setTimeFilterCollapsed] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // AI 搜索
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiMatchedIds, setAiMatchedIds] = useState<Set<string> | null>(null);
  type AiMatchGroup = {
    lotLevelId: string;
    lotLevelName: string;
    businessTypeDisplayName: string;
    businessSectorName: string;
    businessSectorId: string;
    businessTypeId: string;
    templates: Template[];
    keywords: string[];
  };
  const [aiMatchGroups, setAiMatchGroups] = useState<AiMatchGroup[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 弹窗
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  /** 发布：用户确认后再执行状态变更 */
  const [templateActionConfirm, setTemplateActionConfirm] = useState<null | { type: 'publish'; id: string }>(
    null,
  );
  const [templateLogId, setTemplateLogId] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportMetaModal, setShowImportMetaModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMeta, setImportMeta] = useState<TemplateLotMetaValue>(emptyTemplateLotMeta);

  const [createMeta, setCreateMeta] = useState<TemplateLotMetaValue>(emptyTemplateLotMeta);

  /** 一键复制：先填标段 / 名称与描述，再生成副本 */
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [dupCascade, setDupCascade] = useState<LotCascadeValue>(emptyLotCascade);
  const [dupName, setDupName] = useState('');
  const [dupDesc, setDupDesc] = useState('');
  const [dupVersion, setDupVersion] = useState('');

  /** 编辑范本元信息 */
  const [editingMetaTemplate, setEditingMetaTemplate] = useState<Template | null>(null);
  const [editMetaCascade, setEditMetaCascade] = useState<LotCascadeValue>(emptyLotCascade);
  const [editMetaName, setEditMetaName] = useState('');
  const [editMetaDesc, setEditMetaDesc] = useState('');
  const [editMetaVersion, setEditMetaVersion] = useState('');

  const filterBusinessTypes = classificationStore.businessTypes.filter(
    (bt) => bt.businessSectorId === selectedBusinessSectorId,
  );
  const filterLots = classificationStore.lotLevels.filter((l) => {
    if (selectedBusinessTypeId && l.businessTypeId !== selectedBusinessTypeId) return false;
    if (selectedBusinessSectorId && l.businessSectorId !== selectedBusinessSectorId) return false;
    return true;
  });

  // 过滤后的范本列表
  const displayedTemplates = useMemo(() => {
    let result = templates;
    if (selectedLotLevelId) {
      result = result.filter((t) => t.lotLevelId === selectedLotLevelId);
    } else if (selectedBusinessTypeId) {
      result = result.filter((t) => t.businessTypeId === selectedBusinessTypeId);
    } else if (selectedBusinessSectorId) {
      result = result.filter((t) => t.businessSectorId === selectedBusinessSectorId);
    }
    if (aiMatchedIds !== null) {
      result = result.filter(t => aiMatchedIds.has(t.id));
    }
    if (startDate) {
      result = result.filter(t => t.updatedAt >= startDate);
    }
    if (endDate) {
      result = result.filter(t => t.updatedAt <= endDate);
    }
    return sortByCreatedAtDesc(result);
  }, [
    templates,
    selectedBusinessSectorId,
    selectedBusinessTypeId,
    selectedLotLevelId,
    aiMatchedIds,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBusinessSectorId,
    selectedBusinessTypeId,
    selectedLotLevelId,
    aiMatchedIds,
    pageSize,
    startDate,
    endDate,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayedTemplates.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pagedTemplates = useMemo(
    () => displayedTemplates.slice(pageStart, pageStart + pageSize),
    [displayedTemplates, pageStart, pageSize]
  );
  const pageStartLabel = displayedTemplates.length === 0 ? 0 : pageStart + 1;
  const pageEndLabel = Math.min(pageStart + pageSize, displayedTemplates.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const templateForOperationLog = templateLogId
    ? templates.find((x) => x.id === templateLogId)
    : undefined;
  const templateLogTitle = templateForOperationLog?.name
    ? `范本操作日志 · ${templateForOperationLog.name}`
    : '范本操作日志';

  const templateLogEntries = useMemo(
    () => (templateLogId ? getTemplateAuditLogs(templateLogId) : []),
    [templateLogId],
  );

  const progressByTemplateId = useMemo(() => {
    const map = new Map<string, number>();
    templates.forEach((t) => {
      map.set(t.id, calcTemplateEditProgress(t));
    });
    return map;
  }, [templates]);

  // AI 搜索
  const handleAiSearch = async () => {
    if (!aiQuery.trim()) { setAiMatchedIds(null); setAiMatchGroups(null); return; }
    setAiSearching(true);
    try {
      await globalLoading.wrap(async () => {
        await new Promise(r => setTimeout(r, 800));
        const queryTokens = aiQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matchedTemplates = templates.filter(t => scoreTemplate(aiQuery, t) > 0);
        const matched = new Set(matchedTemplates.map(t => t.id));
        setAiMatchedIds(matched);
        const groupMap = new Map<string, AiMatchGroup>();
        for (const t of matchedTemplates) {
          const key = t.lotLevelId || 'uncategorized';
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              lotLevelId: t.lotLevelId || '',
              lotLevelName: t.lotLevelName || '未分类',
              businessTypeDisplayName: t.businessTypeDisplayName || '',
              businessSectorName: t.businessSectorName || '',
              businessSectorId: t.businessSectorId || '',
              businessTypeId: t.businessTypeId || '',
              templates: [],
              keywords: [],
            });
          }
          groupMap.get(key)!.templates.push(t);
        }
        for (const g of groupMap.values()) {
          const text = g.templates.map(t => [t.name, t.description].join(' ')).join(' ').toLowerCase();
          g.keywords = queryTokens.filter(tok => text.includes(tok)).slice(0, 4);
          if (g.keywords.length === 0) g.keywords = queryTokens.slice(0, 3);
        }
        setAiMatchGroups(Array.from(groupMap.values()).sort((a, b) => b.templates.length - a.templates.length));
      }, '正在加载中…');
    } finally {
      setAiSearching(false);
    }
  };

  const clearAiSearch = () => { setAiQuery(''); setAiMatchedIds(null); setAiMatchGroups(null); };

  const applyAiMatchGroup = (group: AiMatchGroup) => {
    setSelectedBusinessSectorId(group.businessSectorId);
    setSelectedBusinessTypeId(group.businessTypeId);
    setSelectedLotLevelId(group.lotLevelId);
    setFilterCollapsed(false);
    // 滚动到列表区域
    setTimeout(() => {
      const listEl = document.getElementById('template-list-anchor');
      if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 操作
  const handlePublish = (id: string) => {
    setTemplates(prev => {
      const next = prev.map(t => t.id === id ? { ...t, status: 'published' as const } : t);
      setMockTemplates(next);
      const t = next.find((x) => x.id === id);
      appendDataAudit({
        scope: 'template',
        action: 'update',
        entityId: id,
        label: t?.name,
        detail: '状态变更为已发布',
        actor: getMockActor(),
      });
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setDeleteTemplateId(id);
  };

  const confirmTemplateStatusAction = () => {
    if (!templateActionConfirm) return;
    handlePublish(templateActionConfirm.id);
    setTemplateActionConfirm(null);
  };

  const confirmDeleteTemplate = () => {
    if (!deleteTemplateId) return;
    const id = deleteTemplateId;
    softDeleteTemplate(id, getMockActor());
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeleteTemplateId(null);
  };

  const handleDownload = async (template: Template) => {
    const fragments = getMockTextFragments();
    const buildExportHTML = (sections: typeof template.sections, depth = 0): string => {
      return sections.map(s => {
        const children = s.children?.length ? buildExportHTML(s.children, depth + 1) : '';
        // 与资源管理中的富文本格式（字体/字号/行距等内联样式）保持一致
        const body = resolveSectionRichHtml(s, template, fragments);
        const content = s.textFragmentId ? `<div>${body}</div>` : body;
        if (!s.title.trim()) {
          return `${content}${children}`;
        }
        const tag = depth === 0 ? 'h2' : 'h3';
        return `<${tag}>${s.title}</${tag}>${content}${children}`;
      }).join('');
    };

    const bodyHtml = sanitizeExportBodyHtml(buildExportHTML(template.sections));
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/1999/xhtml'>
      <head>
        <meta charset="utf-8" />
        <title>${template.name}</title>
        <style>
          body { font-family: "SimSun", "宋体", serif; font-size: 16px; line-height: 29.3px; }
          h1 { font-family: "SimHei", "黑体", sans-serif; font-size: 29.3px; font-weight: 700; text-align: center; line-height: 29.3px; margin: 22px 0; }
          h2 { font-family: "SimHei", "黑体", sans-serif; font-size: 20px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 11px 0; }
          h3 { font-family: "SimHei", "黑体", sans-serif; font-size: 18.7px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 6.6px 0; }
          h4, h5, h6 { font-family: "SimHei", "黑体", sans-serif; font-size: 16px; font-weight: 700; text-align: left; line-height: 29.3px; margin: 6.6px 0; }
          p { font-family: "SimSun", "宋体", serif; font-size: 16px; text-align: justify; line-height: 29.3px; text-indent: 2em; margin: 0; }
          strong, b { font-family: "SimSun", "宋体", serif; font-size: 16px; font-weight: 700; }
          table { border-collapse: collapse; width: 100%; max-width: 100%; table-layout: fixed; border: 2px solid #000; margin: 0.5rem 0; }
          td, th { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; font-size: 14px; line-height: 24px; word-break: break-word; white-space: normal; }
          th { font-family: "SimHei", "黑体", sans-serif; font-weight: 700; background: #fff; border-bottom: 1.5px solid #000; }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;

    try {
      globalLoading.show('正在加载中…');
      // 优先走在线编辑回调同步后的 DOCX 文件。
      const nativeResp = await fetch(`/api/documents/${template.id}`, { method: 'GET' });
      if (nativeResp.ok) {
        const nativeBlob = await nativeResp.blob();
        // 小于该阈值通常是后端自动创建的空白文档，需回退导出。
        if (nativeBlob.size > 3000) {
          const nativeUrl = URL.createObjectURL(nativeBlob);
          const nativeLink = document.createElement('a');
          nativeLink.href = nativeUrl;
          nativeLink.download = `${template.name}.docx`;
          document.body.appendChild(nativeLink);
          nativeLink.click();
          document.body.removeChild(nativeLink);
          URL.revokeObjectURL(nativeUrl);
          return;
        }
      }

      // 回退：若尚无服务端文档稿，则使用现有 HTML->DOCX 导出。
      const blob = await asBlob(fullHtml) as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setSystemNotice('下载失败，请重试');
    } finally {
      globalLoading.hide();
    }
  };

  const cloneRemoteDocument = async (sourceId: string, targetId: string) => {
    const sourceResp = await fetch(`/api/documents/${sourceId}`, { method: 'GET' });
    if (!sourceResp.ok) {
      return;
    }
    const sourceBlob = await sourceResp.blob();
    if (sourceBlob.size <= 0) {
      return;
    }
    const content = await blobToBase64(sourceBlob);
    await fetch(`/api/documents/${targetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  };

  const handleSaveTemplate = (updated: Template) => {
    const computedProgress = calcTemplateEditProgress(updated);
    const isImported = updated.id.startsWith('import-');
    if (isImported) {
      const newId = `tpl-${Date.now()}`;
      const newTpl: Template = {
        ...updated,
        id: newId,
        name: updated.name || '导入范本',
        version: (updated.version ?? '').trim() || 'V1.0',
        status: 'draft',
        editProgress: computedProgress,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      void cloneRemoteDocument(updated.id, newId).catch((err: unknown) => {
        console.error('Failed to clone imported document:', err);
      });
      setTemplates(prev => {
        const next = [...prev, newTpl];
        setMockTemplates(next);
        appendDataAudit({
          scope: 'template',
          action: 'create',
          entityId: newTpl.id,
          label: newTpl.name,
          actor: getMockActor(),
        });
        return next;
      });
    } else {
      setTemplates(prev => {
        const next = prev.map(t => t.id === updated.id ? { ...updated, editProgress: computedProgress } : t);
        setMockTemplates(next);
        appendDataAudit({
          scope: 'template',
          action: 'update',
          entityId: updated.id,
          label: updated.name,
          detail: '编辑器保存',
          actor: getMockActor(),
        });
        return next;
      });
    }
    setEditingTemplate(null);
  };

  const openWpsEditor = (t: Template) => {
    setEditingTemplate(t);
  };

  const handleCloseEditor = () => {
    setEditingTemplate(null);
    setEditingTemplateFile(null);
  };

  const createVersionPlaceholder = useMemo(() => {
    if (createMeta.lotLevelIds.length === 0) return 'V1.0';
    if (createMeta.lotLevelIds.length === 1) {
      return suggestVersionForLot(templates, createMeta.lotLevelIds[0]);
    }
    return '留空则各标段分别递增版本号';
  }, [createMeta.lotLevelIds, templates]);

  const importVersionPlaceholder = useMemo(() => {
    if (importMeta.lotLevelIds.length === 0) return 'V1.0';
    if (importMeta.lotLevelIds.length === 1) {
      return suggestVersionForLot(templates, importMeta.lotLevelIds[0]);
    }
    return '留空则各标段分别递增版本号';
  }, [importMeta.lotLevelIds, templates]);

  const suggestedDupVersion = useMemo(() => {
    if (!dupCascade.lotLevelId) return 'V1.0';
    const n = templates.filter(
      (t) => t.lotLevelId === dupCascade.lotLevelId && !t.deletedAt,
    ).length;
    return `V${n + 1}.0`;
  }, [dupCascade.lotLevelId, templates]);

  const handleCreate = () => {
    const lotIds = createMeta.lotLevelIds;
    if (lotIds.length === 0 || !createMeta.name.trim()) return;
    const now = new Date().toISOString().split('T')[0];
    const baseTs = Date.now();
    const newTemplates = lotIds.map((lotLevelId, index) =>
      makeTpl(
        `tpl-${baseTs}-${index}`,
        createMeta.name.trim(),
        lotLevelId,
        FW_MANUAL,
        createMeta.version.trim() || suggestVersionForLot(templates, lotLevelId),
        'draft',
        0,
        now,
        now,
        createMeta.description,
      ),
    );
    setTemplates((prev) => {
      const next = [...prev, ...newTemplates];
      setMockTemplates(next);
      for (const tpl of newTemplates) {
        appendDataAudit({
          scope: 'template',
          action: 'create',
          entityId: tpl.id,
          label: tpl.name,
          detail: tpl.lotLevelName ? `标段：${tpl.lotLevelName}` : undefined,
          actor: getMockActor(),
        });
      }
      return next;
    });
    setShowCreateModal(false);
    setCreateMeta(emptyTemplateLotMeta());
    setSystemNotice(
      newTemplates.length > 1
        ? `已生成 ${newTemplates.length} 个范本`
        : '已生成范本',
    );
  };

  const openDuplicateModal = (t: Template) => {
    setDuplicateSourceId(t.id);
    setDupCascade(
      t.lotLevelId
        ? lotCascadeFromLotId(classificationStore, t.lotLevelId)
        : emptyLotCascade(),
    );
    const base = t.name.trim();
    setDupName(base ? `${base}（副本）` : '范本（副本）');
    setDupDesc(t.description ?? '');
    setDupVersion('');
  };

  const closeDuplicateModal = () => {
    setDuplicateSourceId(null);
    setDupCascade(emptyLotCascade());
    setDupName('');
    setDupDesc('');
    setDupVersion('');
  };

  const openEditMetaModal = (t: Template) => {
    setEditingMetaTemplate(t);
    setEditMetaCascade(
      t.lotLevelId
        ? lotCascadeFromLotId(classificationStore, t.lotLevelId)
        : emptyLotCascade(),
    );
    setEditMetaName(t.name);
    setEditMetaDesc(t.description ?? '');
    setEditMetaVersion(t.version ?? '');
  };

  const closeEditMetaModal = () => {
    setEditingMetaTemplate(null);
    setEditMetaCascade(emptyLotCascade());
    setEditMetaName('');
    setEditMetaDesc('');
    setEditMetaVersion('');
  };

  const handleEditMetaSave = () => {
    if (!editingMetaTemplate || !editMetaCascade.lotLevelId || !editMetaName.trim()) return;
    const path = getLotLevelPath(editMetaCascade.lotLevelId);
    if (!path) return;

    setTemplates((prev) => {
      const next = prev.map((t) => {
        if (t.id !== editingMetaTemplate.id) return t;
        return {
          ...t,
          name: editMetaName.trim(),
          description: editMetaDesc.trim() || undefined,
          ...templateFieldsFromLotPath(path),
          version: editMetaVersion.trim() || t.version,
          updatedAt: new Date().toISOString().split('T')[0],
        };
      });
      setMockTemplates(next);
      appendDataAudit({
        scope: 'template',
        action: 'update',
        entityId: editingMetaTemplate.id,
        label: editMetaName.trim(),
        detail: '修改范本属性',
        actor: getMockActor(),
      });
      return next;
    });
    closeEditMetaModal();
  };

  const confirmDuplicate = () => {
    if (!duplicateSourceId || !dupCascade.lotLevelId || !dupName.trim()) return;
    const created = duplicateMockTemplate(duplicateSourceId, {
      name: dupName.trim(),
      description: dupDesc.trim(),
      lotLevelId: dupCascade.lotLevelId,
      version: dupVersion.trim() || undefined,
    });
    if (!created) {
      setSystemNotice('复制失败：未找到源范本或标段无效，请重新选择标段。');
      closeDuplicateModal();
      return;
    }
    setTemplates(getMockTemplates());
    closeDuplicateModal();
    setSystemNotice(`已生成副本「${created.name}」，已保存为草稿，可在列表中打开编辑。`);
  };

  const breadcrumb = [
    selectedBusinessSectorId &&
      classificationStore.businessSectors.find((s) => s.id === selectedBusinessSectorId)?.name,
    selectedBusinessTypeId &&
      classificationStore.businessTypes.find((bt) => bt.id === selectedBusinessTypeId)?.displayName,
    selectedLotLevelId &&
      classificationStore.lotLevels.find((l) => l.id === selectedLotLevelId)?.name,
  ].filter(Boolean) as string[];

  const templateStatusConfirmName =
    templateActionConfirm !== null
      ? templates.find((x) => x.id === templateActionConfirm.id)?.name ?? '该范本'
      : '';

  const templateStatusConfirmCopy =
    templateActionConfirm === null
      ? { title: '', message: '', tone: 'info' as const }
      : {
          title: '确认发布',
          message: `确定要发布范本「${templateStatusConfirmName}」吗？发布后状态将变为「已发布」，招标文件管理仅可选择已发布范本。`,
          tone: 'info' as const,
        };

  if (editingTemplate) {
    return (
      <WpsTemplateEditor
        template={editingTemplate}
        onBack={handleCloseEditor}
        onSave={handleSaveTemplate}
        initialFile={editingTemplateFile}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面说明（标题由 MainLayout 顶栏展示，此处不重复） */}
      <p className={systemUi.pageDesc}>基于框架生成范本，编辑内容并预留变量</p>

      {/* AI 搜索框 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <input
            type="text"
            placeholder="用自然语言描述您需要的范本，例如：适合储能EPC项目的资格要求条款..."
            value={aiQuery}
            onChange={e => { setAiQuery(e.target.value); if (!e.target.value) setAiMatchedIds(null); }}
            onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
            className="w-full pl-10 pr-28 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {aiSearching && (
            <Loader2 className="absolute right-20 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
          )}
          {aiQuery && !aiSearching && (
            <button onClick={clearAiSearch} className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleAiSearch}
            disabled={aiSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            AI 搜索
          </button>
        </div>
        {/* AI 筛选结果面板 */}
        {aiMatchGroups !== null && aiMatchGroups.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  AI 推荐
                </span>
                <span className="text-xs text-slate-500">
                  匹配到 <b className="text-slate-700">{aiMatchGroups.length}</b> 个标段 · <b className="text-slate-700">{aiMatchedIds?.size ?? 0}</b> 个范本
                </span>
              </div>
              <button onClick={clearAiSearch} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X className="w-3 h-3" /> 清除
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {aiMatchGroups.map((group) => (
                <button
                  key={group.lotLevelId}
                  onClick={() => applyAiMatchGroup(group)}
                  className={`group text-left relative border rounded-lg px-3 py-2.5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    selectedLotLevelId === group.lotLevelId
                      ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-300'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                  style={{ minWidth: 200, maxWidth: 280 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                        {group.lotLevelName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {group.businessSectorName} › {group.businessTypeDisplayName}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {group.templates.length} 个
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {group.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  {selectedLotLevelId === group.lotLevelId && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">点击卡片可快速定位到对应标段筛选</p>
          </div>
        )}
      </div>

      {/* 标段筛选面板 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setFilterCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            标段筛选
            {breadcrumb.length > 0 && (
              <span className="text-xs text-blue-600 font-normal">{breadcrumb.join(' › ')}</span>
            )}
          </span>
          {filterCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </button>

        {!filterCollapsed && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">业务板块</div>
                <div className="max-h-44 overflow-y-auto">
                  {classificationStore.businessSectors.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const on = selectedBusinessSectorId === s.id;
                        setSelectedBusinessSectorId(on ? '' : s.id);
                        setSelectedBusinessTypeId('');
                        setSelectedLotLevelId('');
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                        selectedBusinessSectorId === s.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {s.name}
                      {selectedBusinessSectorId === s.id && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">能源/业务类型</div>
                <div className="max-h-44 overflow-y-auto">
                  {!selectedBusinessSectorId ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">请先选择业务板块</div>
                  ) : (
                    filterBusinessTypes.map((bt) => (
                      <button
                        key={bt.id}
                        type="button"
                        onClick={() => {
                          const on = selectedBusinessTypeId === bt.id;
                          setSelectedBusinessTypeId(on ? '' : bt.id);
                          setSelectedLotLevelId('');
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                          selectedBusinessTypeId === bt.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {bt.displayName}
                        {selectedBusinessTypeId === bt.id && <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">标段级别</div>
                <div className="max-h-44 overflow-y-auto">
                  {!selectedBusinessTypeId ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">请先选择业务类型</div>
                  ) : (
                    filterLots.map((lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() =>
                          setSelectedLotLevelId(selectedLotLevelId === lot.id ? '' : lot.id)
                        }
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                          selectedLotLevelId === lot.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{lot.name}</span>
                        {selectedLotLevelId === lot.id && (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 时间查询模块（独立） */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setTimeFilterCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            更新时间查询
          </span>
          {timeFilterCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </button>
        {!timeFilterCollapsed && (
          <div className="border-t border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">按更新时间筛选</div>
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  清空条件
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                <span className="text-xs text-slate-500">开始日期</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <span className="text-slate-400 text-sm">至</span>
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                <span className="text-xs text-slate-500">结束日期</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              按范本更新时间进行区间过滤（包含起止日期）
            </div>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1.5">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-slate-300 text-xs">›</span>}
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{crumb}</span>
                </span>
              ))}
              <button
                onClick={() => {
                  setSelectedBusinessSectorId('');
                  setSelectedBusinessTypeId('');
                  setSelectedLotLevelId('');
                }}
                className="ml-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {(startDate || endDate) && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
              时间：{startDate || '不限'} ~ {endDate || '不限'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportMeta(emptyTemplateLotMeta());
              setShowImportMetaModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入范本
          </button>
          <button
            onClick={() => {
              setCreateMeta(emptyTemplateLotMeta());
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建范本
          </button>
        </div>
      </div>

      {/* 范本表格 */}
      <div id="template-list-anchor" className={systemUi.card}>
        <table className={systemUi.table}>
          <thead className="sticky top-0 z-10">
            <tr className={systemUi.tableHeadRow}>
              <th className={`${systemUi.tableTh} w-[11rem]`}>范本名称</th>
              <th className={systemUi.tableTh}>所属标段</th>
              <th className={`${systemUi.tableTh} w-16`}>版本</th>
              <th className={`${systemUi.tableTh} w-32`}>编辑进度</th>
              <th className={`${systemUi.tableTh} w-24`}>状态</th>
              <th className={`${systemUi.tableTh} w-24`}>更新时间</th>
              <th className={`${systemUi.tableTh} w-36`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedTemplates.length === 0 ? (
              <tr>
                <td colSpan={7} className={systemUi.tableEmpty}>
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>暂无范本</p>
                </td>
              </tr>
            ) : (
              pagedTemplates.map(t => {
                const progress = progressByTemplateId.get(t.id) ?? 0;
                return (
                  <tr
                    key={t.id}
                    className={`${systemUi.tableRow} ${
                      aiMatchedIds?.has(t.id) ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : ''
                    }`}
                  >
                  <td className={systemUi.tableTd}>
                    <div className={systemUi.tableCellName}>{t.name}</div>
                    {t.description?.trim() && (
                      <SystemTooltip content={t.description} placement="top">
                        <span className={`${systemUi.tableCellDesc} mt-0.5`}>
                          {previewTableText(t.description)}
                        </span>
                      </SystemTooltip>
                    )}
                  </td>
                  <td className={systemUi.tableTd}>
                    <div className={systemUi.tableCellTitle}>{t.lotLevelName}</div>
                    <div className={systemUi.tableCellSub}>
                      {t.businessSectorName} · {t.businessTypeDisplayName}
                    </div>
                  </td>
                  <td className={systemUi.tableTd}>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">{t.version ?? 'V1.0'}</span>
                  </td>
                  <td className={systemUi.tableTd}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right tabular-nums">{progress}%</span>
                    </div>
                  </td>
                  <td className={`${systemUi.tableTd} whitespace-nowrap`}><StatusBadge status={t.status} /></td>
                  <td className={`${systemUi.tableTdMuted} whitespace-nowrap tabular-nums`}>{t.updatedAt}</td>
                  <td className={systemUi.tableTd}>
                    <div className="flex items-center gap-0.5">
                      <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" title="编辑" onClick={() => openWpsEditor(t)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDuplicateModal(t)}
                        className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                        title="一键复制（含正文与文本插入关系）"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMetaModal(t)}
                        className="p-1.5 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                        title="编辑范本信息"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      {t.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setTemplateActionConfirm({ type: 'publish', id: t.id })}
                          className="p-1.5 rounded hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="发布"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDownload(t)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" title="下载">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTemplateLogId(t.id);
                        }}
                        className="p-1.5 rounded hover:bg-violet-50 text-slate-500 hover:text-violet-700 transition-colors cursor-pointer"
                        title="操作日志"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors cursor-pointer" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className={systemUi.tableFooter}>
          <div className="text-xs text-slate-500">
            显示第 {pageStartLabel}-{pageEndLabel} 条，共 {displayedTemplates.length} 条
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>每页</span>
              <FormSelect
                selectSize="xs"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                wrapperClassName="w-auto"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </FormSelect>
              <span>条</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-2 text-xs text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新建范本弹窗 */}
      {showCreateModal && (
        <ModalOverlay>
          <div className={systemUi.modalPanel} style={{ width: '56rem', maxWidth: 'calc(100vw - 2rem)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">新建范本</h3>
              <button onClick={() => { setShowCreateModal(false); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <TemplateLotMetaFields
                value={createMeta}
                onChange={setCreateMeta}
                store={classificationStore}
                versionPlaceholder={createVersionPlaceholder}
              />
              {createMeta.lotLevelIds.length > 0 && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mt-4">
                  生成后进入编辑器，通过标题与正文<strong className="font-medium text-slate-700">手动搭建</strong>章节结构；保存时会同步到范本大纲（供资源绑定勾选）。
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
              <button
                onClick={handleCreate}
                disabled={createMeta.lotLevelIds.length === 0 || !createMeta.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMeta.lotLevelIds.length > 1
                  ? `生成 ${createMeta.lotLevelIds.length} 个范本`
                  : '生成范本'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 复制范本：确认标段 / 名称与描述后再生成 */}
      {duplicateSourceId && (
        <ModalOverlay>
          <div className={systemUi.modalPanel}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">复制范本</h3>
                <p className="text-xs text-slate-500 mt-0.5">请重新选择业务板块与标段，并确认范本名称与描述后生成副本（正文与资源插入关系一并保留）。</p>
              </div>
              <button type="button" onClick={closeDuplicateModal} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <LotCascadeFields
                value={dupCascade}
                onChange={setDupCascade}
                store={classificationStore}
                required
              />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  范本名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  placeholder="请输入副本名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本描述</label>
                <textarea
                  value={dupDesc}
                  onChange={(e) => setDupDesc(e.target.value)}
                  placeholder="请输入范本描述"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
                <input
                  type="text"
                  value={dupVersion}
                  onChange={(e) => setDupVersion(e.target.value)}
                  placeholder="如 V1.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={closeDuplicateModal}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDuplicate}
                disabled={!dupCascade.lotLevelId || !dupName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确定并生成副本
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 导入文档元信息弹窗 */}
      {showImportMetaModal && (
        <ImportMetaModal
          meta={importMeta}
          versionPlaceholder={importVersionPlaceholder}
          onChange={setImportMeta}
          onClose={() => setShowImportMetaModal(false)}
          onNext={() => { setShowImportMetaModal(false); setShowImportModal(true); }}
        />
      )}

      {/* 导入文档弹窗 */}
      {showImportModal && (
        <ImportDocumentModal
          meta={importMeta}
          templates={templates}
          onClose={() => setShowImportModal(false)}
          onBack={() => { setShowImportModal(false); setShowImportMetaModal(true); }}
          onImported={(imported, file) => {
            setShowImportModal(false);
            setTemplates((prev) => {
              const next = [...prev, ...imported];
              setMockTemplates(next);
              for (const tpl of imported) {
                appendDataAudit({
                  scope: 'template',
                  action: 'create',
                  entityId: tpl.id,
                  label: tpl.name,
                  detail: tpl.lotLevelName ? `导入生成 · ${tpl.lotLevelName}` : '导入生成',
                  actor: getMockActor(),
                });
              }
              return next;
            });
            if (imported.length > 0) {
              setEditingTemplateFile(file);
              openWpsEditor(imported[0]);
            }
            if (imported.length > 1) {
              setSystemNotice(`已导入并生成 ${imported.length} 个范本，当前打开第 1 个`);
            }
          }}
        />
      )}

      <SystemDialog
        open={templateActionConfirm !== null}
        title={templateStatusConfirmCopy.title}
        message={templateStatusConfirmCopy.message}
        tone={templateStatusConfirmCopy.tone}
        variant="confirm"
        onClose={() => setTemplateActionConfirm(null)}
        onConfirm={confirmTemplateStatusAction}
      />

      <SystemDialog
        open={deleteTemplateId !== null}
        title="确认删除"
        message="确定要删除此范本吗？"
        tone="danger"
        variant="confirm"
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={confirmDeleteTemplate}
      />

      <SystemDialog
        open={systemNotice !== null}
        title="系统提示"
        message={systemNotice ?? ''}
        onClose={() => setSystemNotice(null)}
        onConfirm={() => setSystemNotice(null)}
      />

      <OperationLogDialog
        open={templateLogId !== null}
        onClose={() => setTemplateLogId(null)}
        title={templateLogTitle}
        entries={templateLogEntries}
      />

      {/* 编辑范本信息弹窗 */}
      {editingMetaTemplate && (
        <ModalOverlay>
          <div className={systemUi.modalPanel}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">编辑范本信息</h3>
              <button onClick={closeEditMetaModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <LotCascadeFields
                value={editMetaCascade}
                onChange={setEditMetaCascade}
                store={classificationStore}
                required
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本名称 <span className="text-rose-500">*</span></label>
                <input type="text" value={editMetaName} onChange={e => setEditMetaName(e.target.value)}
                  placeholder="请输入范本名称"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">版本号</label>
                <input
                  type="text"
                  value={editMetaVersion}
                  onChange={(e) => setEditMetaVersion(e.target.value)}
                  placeholder="如 V1.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">范本描述</label>
                <textarea value={editMetaDesc} onChange={e => setEditMetaDesc(e.target.value)}
                  placeholder="请输入范本描述" rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeEditMetaModal} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
              <button onClick={handleEditMetaSave} disabled={!editMetaCascade.lotLevelId || !editMetaName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                保存
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
}

// ─── 导入文档元信息弹窗 ─────────────────────────────────────────────────────────

interface ImportMetaModalProps {
  meta: TemplateLotMetaValue;
  versionPlaceholder: string;
  onChange: (meta: TemplateLotMetaValue) => void;
  onClose: () => void;
  onNext: () => void;
}

function ImportMetaModal({ meta, versionPlaceholder, onChange, onClose, onNext }: ImportMetaModalProps) {
  const store = useMemo(() => getClassificationStore(), []);
  const canNext = meta.lotLevelIds.length > 0 && meta.name.trim();

  return (
    <ModalOverlay>
      <div className={`${systemUi.modalPanel} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">导入范本</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <TemplateLotMetaFields
            value={meta}
            onChange={onChange}
            store={store}
            versionPlaceholder={versionPlaceholder}
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
          <button
            onClick={onNext}
            disabled={!canNext}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {meta.lotLevelIds.length > 1 ? '继续解析（将生成多个范本）' : '继续解析'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── 导入文档弹窗 ───────────────────────────────────────────────────────────────

interface ImportDocumentModalProps {
  meta: TemplateLotMetaValue;
  templates: Template[];
  onClose: () => void;
  onBack: () => void;
  onImported: (templates: Template[], file: File | null) => void;
}

function ImportDocumentModal({ meta, templates, onClose, onBack, onImported }: ImportDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [showPreview, setShowPreview] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError('');
      setPreviewHtml('');
      setPreviewTitle(null);
      setShowPreview(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError('');
      setPreviewHtml('');
      setPreviewTitle(null);
      setShowPreview(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let html = '';
      let title: string | null = null;
      
      if (ext === 'docx') {
        // 使用增强解析器，支持图片嵌入
        const result = await parseDocxEnhanced(file, {
          embedImages: true,
          preserveStyleIds: true,
        });
        html = result.html;
        title = result.title;
      } else if (ext === 'doc') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          html = postProcessMammothHTML(result.value);
        } catch {
          html = `<h2>第一章 招标公告</h2><p>基于文档《${file.name}》导入的招标公告内容。</p><h2>第二章 投标人须知</h2><p>投标人须知条款内容。</p><h2>第三章 技术规格要求</h2><p>技术规格及参数要求。</p><h2>第四章 评标办法</h2><p>评标标准及办法。</p><h2>第五章 合同条款</h2><p>合同主要条款。</p>`;
        }
      } else if (ext === 'pdf') {
        html = `<h2>第一章 招标公告</h2><p>基于 PDF 文档《${file.name}》解析的招标公告内容示例。</p><h2>第二章 投标人须知</h2><p>投标人须知条款内容示例。</p><h2>第三章 技术规格要求</h2><p>技术规格及参数要求示例。</p><h2>第四章 评标办法</h2><p>评标标准及办法示例。</p><h2>第五章 合同条款</h2><p>合同主要条款示例。</p>`;
      } else {
        throw new Error('仅支持 .doc、.docx、.pdf 格式文件');
      }

      if (!html.includes('<h') && !html.includes('<H')) {
        html = `<h2>${file.name.replace(/\.[^.]+$/, '')}</h2><div class="quoted-block">${html}</div>`;
      }

      setPreviewHtml(html);
      setPreviewTitle(title);
      setShowPreview(true);
      setActiveTab('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const parseDocument = async () => {
    if (!file) return;
    
    // 如果已经预览过，直接使用预览的HTML
    let html = previewHtml;
    let fallbackNotice = '';
    
    if (!html) {
      // 如果没有预览，先解析
      setParsing(true);
      setError('');
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'docx') {
          const result = await parseDocxEnhanced(file, {
            embedImages: true,
            preserveStyleIds: true,
          });
          html = result.html;
        } else if (ext === 'doc') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            html = postProcessMammothHTML(result.value);
          } catch {
            fallbackNotice = `<p style="background:#fffbeb;border:1px solid #fcd34d;color:#b45309;padding:8px 12px;border-radius:6px;font-size:13px;">该文件为旧版 .doc 格式，系统已将其转为可编辑文本，您可直接在编辑器中修改。</p>`;
            html = `<h2>第一章 招标公告</h2><p>基于文档《${file.name}》导入的招标公告内容。</p><h2>第二章 投标人须知</h2><p>投标人须知条款内容。</p><h2>第三章 技术规格要求</h2><p>技术规格及参数要求。</p><h2>第四章 评标办法</h2><p>评标标准及办法。</p><h2>第五章 合同条款</h2><p>合同主要条款。</p>`;
          }
        } else if (ext === 'pdf') {
          html = `<h2>第一章 招标公告</h2><p>基于 PDF 文档《${file.name}》解析的招标公告内容示例。</p><h2>第二章 投标人须知</h2><p>投标人须知条款内容示例。</p><h2>第三章 技术规格要求</h2><p>技术规格及参数要求示例。</p><h2>第四章 评标办法</h2><p>评标标准及办法示例。</p><h2>第五章 合同条款</h2><p>合同主要条款示例。</p>`;
        }

        if (!html.includes('<h') && !html.includes('<H')) {
          html = `<h2>${file.name.replace(/\.[^.]+$/, '')}</h2><div class="quoted-block">${html}</div>`;
        }

        if (fallbackNotice) {
          html = fallbackNotice + html;
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '解析失败');
        setParsing(false);
        return;
      } finally {
        setParsing(false);
      }
    }

    const lotIds = meta.lotLevelIds.length > 0
      ? meta.lotLevelIds
      : (meta.lotLevelId ? [meta.lotLevelId] : []);
    if (lotIds.length === 0) return;

    const baseTs = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const importedTemplates: Template[] = lotIds.map((lotLevelId, index) => {
      const path = getLotLevelPath(lotLevelId);
      const id = `import-${baseTs}-${index}`;
      const sections = parseSectionsFromHTML(html, id);
      return {
        id,
        name: meta.name || file.name.replace(/\.[^.]+$/, ''),
        description: meta.description || `由文档《${file.name}》导入生成`,
        frameworkId: 'fw-default',
        lotLevelId,
        ...(path ? templateFieldsFromLotPath(path) : {}),
        version: meta.version?.trim() || suggestVersionForLot(templates, lotLevelId),
        status: 'draft' as const,
        editProgress: 100,
        createdAt: today,
        updatedAt: today,
        sections,
        variables: [],
      };
    });

    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        const content = await blobToBase64(file);
        saveTemplateDocxCache(importedTemplates[0]?.id ?? `import-${baseTs}-0`, content);
        await Promise.all(
          importedTemplates.map((tpl) => {
            saveTemplateDocxCache(tpl.id, content);
            return fetch(`/api/documents/${encodeURIComponent(tpl.id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
            });
          }),
        );
      } catch {
        /* 编辑器打开时会再次尝试上传 */
      }
    }

    onImported(importedTemplates, file);
  };

  return (
    <ModalOverlay>
      <div
        className={`saas-modal-panel flex flex-col max-h-[90vh] bg-white rounded-xl shadow-xl transition-all duration-300 ${
          showPreview ? 'saas-modal-panel-xl' : ''
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">导入标书文档</h3>
            {previewTitle && (
              <p className="text-xs text-slate-500 mt-0.5">识别标题：{previewTitle}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`${showPreview ? 'flex' : 'block'} overflow-hidden`} style={{ height: showPreview ? '600px' : 'auto' }}>
          {/* 左侧：文件选择和预览控制 */}
          <div className={`${showPreview ? 'w-80 border-r border-slate-200' : 'w-full'} flex flex-col`}>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                {file ? (
                  <div className="space-y-1">
                    <FileText className="w-6 h-6 mx-auto text-blue-500" />
                    <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">点击或拖拽更换文件</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-xs text-slate-500">点击或拖拽文件上传</p>
                    <p className="text-xs text-slate-400">支持 .doc / .docx / .pdf</p>
                  </div>
                )}
                <input
                  id="import-file-input"
                  type="file"
                  accept=".doc,.docx,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-200">
                  {error}
                </div>
              )}

              {file && (
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>大小：{(file.size / 1024).toFixed(1)} KB</span>
                  <span>格式：{file.name.split('.').pop()?.toUpperCase()}</span>
                </div>
              )}

              {/* 预览按钮 */}
              {file && !showPreview && (
                <button
                  onClick={handlePreview}
                  disabled={parsing}
                  className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {parsing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {parsing ? '解析中...' : '预览文档'}
                </button>
              )}

              {showPreview && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="w-full px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    关闭预览
                  </button>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={onBack} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">上一步</button>
              <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors">取消</button>
              <button
                onClick={parseDocument}
                disabled={!file || parsing}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {parsing && <Loader2 className="w-4 h-4 animate-spin" />}
                {parsing ? '解析中...' : '确认导入'}
              </button>
            </div>
          </div>

          {/* 右侧：预览区域 */}
          {showPreview && previewHtml && (
            <div className="flex-1 flex flex-col bg-slate-50">
              {/* 标签页 */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  渲染预览
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'code'
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  HTML 源码
                </button>
              </div>

              {/* 预览内容 */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'preview' && (
                  <div
                    className="bg-white p-8 rounded-lg shadow-sm docx-preview"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
                {activeTab === 'code' && (
                  <pre className="text-xs text-slate-700 bg-white p-4 rounded-lg shadow-sm overflow-auto whitespace-pre-wrap border border-slate-200" style={{ maxHeight: '500px' }}>
                    {formatHtml(previewHtml)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function formatHtml(html: string): string {
  let formatted = '';
  let indent = '';
  const tab = '  ';
  html.split(/>(<)/).forEach((element) => {
    if (element.match(/^\/\w/)) {
      indent = indent.substring(tab.length);
    }
    formatted += indent + element + '>\n';
    if (element.match(/^<?\w[^>]*[^\/]$/)) {
      indent += tab;
    }
  });
  return formatted.substring(1, formatted.length - 3);
}
