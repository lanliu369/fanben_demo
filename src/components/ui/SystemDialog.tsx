'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';

type DialogTone = 'info' | 'warning' | 'danger';

function confirmButtonClasses(tone: DialogTone): string {
  const focus =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  switch (tone) {
    case 'danger':
      return `bg-rose-600 hover:bg-rose-700 ${focus} focus-visible:outline-rose-600`;
    case 'warning':
      return `bg-amber-500 hover:bg-amber-600 ${focus} focus-visible:outline-amber-500`;
    default:
      return `bg-blue-600 hover:bg-blue-700 ${focus} focus-visible:outline-blue-600`;
  }
}

type SystemDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** 主按钮语义色：info 蓝（默认）、warning 琥珀（归档类）、danger 红（删除） */
  tone?: DialogTone;
  variant?: 'alert' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function SystemDialog({
  open,
  title,
  message,
  tone = 'info',
  variant = 'alert',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onClose,
}: SystemDialogProps) {
  if (!open) return null;

  const confirmBtnClass = confirmButtonClasses(tone);

  return (
    <ModalOverlay zClassName="z-[100]">
      <div className="saas-modal-panel saas-modal-panel--compact rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm leading-6 text-slate-600">
          {message}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
          {variant === 'confirm' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm text-white transition-colors ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
