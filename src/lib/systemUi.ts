/**
 * 全站 UI token（与 MainLayout / CLAUDE.md 飞书 SaaS 规范一致）
 * 表格、按钮、卡片等均由此导出，避免单页自建组件或独立样式体系。
 */
export const systemUi = {
  /** 顶栏标题下方的页面说明（与 MainLayout 顶栏配合，勿重复大标题） */
  pageDesc: 'text-sm text-slate-500',

  table: 'saas-table w-full text-sm border-collapse',
  tableHeadRow: 'border-b border-slate-200 bg-slate-50',
  tableTh:
    'text-left px-4 py-2.5 text-sm font-semibold text-slate-500 whitespace-nowrap',
  tableThRight:
    'text-right px-4 py-2.5 text-sm font-semibold text-slate-500 whitespace-nowrap',
  tableRow: 'border-b border-slate-100 hover:bg-slate-50 transition-colors',
  tableTd: 'px-4 py-3 align-middle text-sm text-slate-900',
  tableTdMuted: 'px-4 py-3 align-middle text-sm text-slate-500',
  tableCellTitle: 'text-sm font-medium text-slate-900',
  tableCellSub: 'text-xs text-slate-500 mt-0.5',
  /** 列表主列名称（收窄列宽） */
  tableCellName: 'text-sm font-medium text-slate-900 truncate max-w-[10rem]',
  /** 列表主列副文案（单行截断，悬停 SystemTooltip 看全文） */
  tableCellDesc:
    'block text-[11px] leading-tight text-slate-500 line-clamp-1 max-w-[10rem] cursor-default',
  tooltip:
    'w-max max-w-xs px-2.5 py-2 text-xs leading-relaxed text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm pointer-events-none',
  tableEmpty: 'px-4 py-12 text-center text-sm text-slate-500',
  tableFooter:
    'border-t border-slate-100 px-4 py-3 flex items-center justify-between bg-white text-xs text-slate-500',

  card: 'bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden',
  btnPrimary:
    'inline-flex items-center justify-center gap-1.5 h-8 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm',
  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors',

  /** @deprecated 请用 FormSelect 组件；保留供尚未迁移的 select */
  formSelect:
    'w-full h-9 border border-slate-200 rounded-lg pl-3 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-colors',
  formSelectCompact:
    'saas-select-compact border border-slate-200 rounded-md pl-2 py-1 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',

  /** 弹窗蒙层（与 ModalOverlay 组件一致，供不便引入组件时使用） */
  modalBackdrop: 'absolute inset-0 bg-black/50',
  /** 多字段表单弹窗：视口自适应，最大约 896px（globals.css .saas-modal-panel） */
  modalPanel: 'saas-modal-panel bg-white rounded-xl shadow-xl',
  /** 较宽弹窗：最大约 992px */
  modalPanelLg: 'saas-modal-panel saas-modal-panel-lg bg-white rounded-xl shadow-xl',
  /** 紧凑弹窗：最大 480px（与招采分类目录弹窗一致） */
  modalPanelCompact: 'saas-modal-panel saas-modal-panel--compact bg-white rounded-xl shadow-xl',
} as const;
