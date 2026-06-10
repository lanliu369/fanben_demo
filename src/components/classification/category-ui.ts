import { systemUi } from '@/lib/systemUi';

/**
 * 招采分类页视觉 token（与 MainLayout / CLAUDE.md 飞书 SaaS 规范一致）
 */
export function navTreeRowClass(active: boolean, inPath?: boolean) {
  return `group flex items-center gap-1 pr-2 py-1.5 rounded-lg transition-colors ${
    active
      ? 'bg-blue-50 text-blue-600'
      : inPath
        ? 'text-slate-700 font-medium'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;
}

export const categoryUi = {
  page: 'category-page flex flex-col gap-3 min-h-0',
  pageTitle: 'text-base font-semibold text-slate-900 leading-tight',
  detailTitle: 'text-base font-semibold text-slate-900',
  moduleTitle: 'text-sm font-semibold text-slate-900',
  body: 'text-sm text-slate-700',
  pageDesc: systemUi.pageDesc,
  hint: 'text-xs text-slate-500',

  shell:
    'bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-1 min-h-[560px] shadow-sm',
  aside: 'w-[340px] shrink-0 flex flex-col border-r border-slate-100 bg-white min-h-0 overflow-hidden',
  asideHeader:
    'px-4 py-3 text-sm font-semibold text-slate-900 border-b border-slate-100 shrink-0',
  treePanelHead:
    'px-3 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100 shrink-0 min-w-0',
  treePanelActions: 'flex items-center gap-0.5 shrink-0',
  treeIconBtn:
    'w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0',
  treeRow:
    'group flex items-center gap-0.5 h-9 rounded-md mx-1.5 pr-1 transition-colors hover:bg-slate-50',
  treeRowActive: 'bg-blue-50',
  treeToggle: 'w-5 h-5 flex items-center justify-center shrink-0 text-slate-400',
  treeLabelBtn: 'flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden text-left',
  treeLabel: 'text-[13px] text-slate-800 truncate min-w-0 flex-1',
  treeOps: 'flex items-center gap-0.5 shrink-0 pl-1 -translate-x-0.5',
  treeOpsHidden: 'hidden group-hover:flex',
  treeOpBtn:
    'w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0',
  treeOpBtnDanger: 'hover:bg-rose-50 hover:text-rose-600',
  treeDescBox:
    'text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg pl-5 pr-4 py-5 min-h-[3.25rem] border-l-[3px] border-l-blue-600',
  main: 'flex-1 min-w-0 flex flex-col bg-slate-50/50',

  toolbarRow: 'flex items-center justify-between gap-4 flex-wrap',
  toolbarActions: 'flex items-center gap-2 shrink-0 flex-wrap',

  segment: 'inline-flex p-0.5 rounded-lg border border-slate-200 bg-slate-50',
  segmentBtn:
    'h-8 px-3 text-sm rounded-md transition-colors text-slate-600 hover:text-slate-900',
  segmentBtnActive: 'bg-white text-blue-600 font-medium shadow-sm',

  filterPanel: 'bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden',
  filterRow:
    'flex flex-nowrap items-center gap-2 px-4 py-2.5 overflow-x-auto',
  filterRowStyle: { flexWrap: 'nowrap', overflowX: 'auto' } as const,
  advancedFilterPanel: 'border-t border-slate-100 bg-slate-50/40 px-4 py-4',
  advancedFilterGrid:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3',
  advancedFilterField: 'flex flex-col gap-1.5 min-w-0',
  advancedFilterLabel: 'text-xs font-medium text-slate-600',
  control:
    'h-8 border border-slate-200 rounded-lg pl-3 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-colors',
  formSelect: systemUi.formSelect,
  formField: `${systemUi.formSelect} placeholder:text-slate-400`,
  formTextarea:
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y min-h-[56px] transition-colors',
  directoryModal:
    'saas-modal-panel saas-modal-panel--compact bg-white rounded-xl shadow-lg border border-slate-200',
  directoryModalHead: 'flex items-center justify-between px-6 py-4 border-b border-slate-100',
  directoryModalBody: 'px-6 py-5 space-y-4',
  directoryModalFoot: 'flex justify-end gap-2 border-t border-slate-100',
  directoryFormItem: 'flex flex-col gap-1.5',
  directoryFormLabel: 'text-[13px] font-medium text-slate-900 leading-snug',
  directoryFormInput:
    'w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 bg-white outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50 disabled:text-slate-500',
  directoryFormHint: 'text-xs text-slate-500 mt-1',
  directoryLotProcGrid: 'grid grid-cols-2 gap-2',
  directoryLotProcOption: (checked: boolean) =>
    `flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 text-[13px] transition-colors border ${
      checked
        ? 'border-blue-500 bg-blue-50 text-blue-600'
        : 'border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300'
    }`,
  searchInput:
    'h-8 border border-slate-200 rounded-lg pl-9 pr-3 text-sm w-full min-w-0 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
  /** 筛选条控件宽度（内联 style，避免 Tailwind 任意宽度未生成） */
  filterSelectWidths: {
    sector: '8.5rem',
    dimension: '7rem',
    procurement: '7.5rem',
  },
  filterSearchGrow: { flex: '1 1 14rem', minWidth: '14rem' } as const,

  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-slate-700 border border-slate-200 bg-white rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors',
  /** 工具栏按钮内图标色块（与数据看板快速操作一致） */
  toolbarIconBlue: 'p-1 rounded-md bg-blue-50 text-blue-600',
  toolbarIconGreen: 'p-1 rounded-md bg-green-50 text-green-600',
  toolbarIconViolet: 'p-1 rounded-md bg-violet-50 text-violet-600',
  toolbarIconSlate: 'p-1 rounded-md bg-slate-100 text-slate-600',
  btnPrimary:
    'inline-flex items-center justify-center gap-1.5 h-8 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm',
  btnDangerOutline:
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-rose-600 border border-rose-200 bg-white rounded-lg hover:bg-rose-50 transition-colors',
  btnGhost:
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors',

  detailHeader: 'px-5 py-4 bg-white border-b border-slate-100 shrink-0',
  detailHeaderTitle: 'text-lg font-semibold text-slate-900 break-words leading-snug',
  detailHeaderMeta: 'flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs text-slate-500',
  detailHeaderActions: 'flex flex-wrap items-center justify-end gap-2 pt-1',
  detailBody: 'flex-1 overflow-y-auto p-6 space-y-4 min-h-0',
  /** 基本信息：固定 label 宽 + 纵向单列 + 行间分隔线 */
  detailInfoList: 'flex flex-col',
  detailInfoRow: 'flex items-start gap-3 min-w-0 py-2.5 border-b border-slate-100',
  detailInfoLabel: 'w-28 shrink-0 text-sm text-slate-500 leading-snug',
  detailInfoValue: 'flex-1 min-w-0 text-sm text-slate-900 leading-relaxed break-words',
  infoCard:
    'bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow',
  descCard: 'bg-slate-50 border border-slate-100 rounded-lg',

  descLabel: 'text-xs text-slate-500 mb-1',
  descValue: 'text-sm text-slate-900',

  badge: 'text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0',

  table: `${systemUi.table} table-fixed`,
  tableHead: 'sticky top-0 z-10',
  tableHeadRow: systemUi.tableHeadRow,
  tableTh: `${systemUi.tableTh} bg-slate-50`,
  tableThRight: `${systemUi.tableThRight} bg-slate-50`,
  tableRow: systemUi.tableRow,
  tableTd: systemUi.tableTd,
  tableTdMuted: systemUi.tableTdMuted,
  tableCellTitle: systemUi.tableCellTitle,
  tableCellSub: systemUi.tableCellSub,
  tableEmpty: systemUi.tableEmpty,
  tableFooter:
    'shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white text-xs text-slate-500',

  /** 下拉浮层容器（须配合 absolute + top-full 使用） */
  dropdownPanel:
    'w-max min-w-[9.5rem] whitespace-nowrap rounded-lg border border-slate-200 bg-white py-1 shadow-sm',
  dropdownItem:
    'block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap',
  dropdownItemDanger:
    'block w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap',
  actionBtn:
    'inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors',

  childLotItem:
    'flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-colors text-sm',

  drawerOverlay: 'fixed inset-0 z-40 bg-black/30',
  drawerPanel:
    'fixed right-0 top-0 z-50 h-full w-[360px] max-w-[90vw] bg-white border-l border-slate-200 shadow-sm flex flex-col',
  drawerHeader:
    'flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0',
  drawerBody: 'flex-1 overflow-y-auto px-5 py-4 space-y-4',
  drawerFooter:
    'flex justify-end gap-2 px-5 py-4 border-t border-slate-100 shrink-0',
} as const;
