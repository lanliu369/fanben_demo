'use client';

import { useEffect, useState } from 'react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

const DEFAULT_PHRASE = '我确认删除';

type TypedConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** 须完整输入的确认文案，默认「我确认删除」 */
  confirmPhrase?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function TypedConfirmDeleteDialog({
  open,
  title,
  message,
  confirmPhrase = DEFAULT_PHRASE,
  onConfirm,
  onClose,
}: TypedConfirmDeleteDialogProps) {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (open) setInput('');
  }, [open]);

  if (!open) return null;

  const matched = input === confirmPhrase;

  return (
    <ModalOverlay zClassName="z-[100]">
      <div className="saas-modal-panel saas-modal-panel--compact rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-600">
          <p className="leading-6">{message}</p>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              请输入以下文字以确认删除：
              <span className="ml-1 font-medium text-rose-600">{confirmPhrase}</span>
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={confirmPhrase}
              className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!matched}
            onClick={() => {
              if (!matched) return;
              onConfirm();
            }}
            className="rounded-lg px-4 py-2 text-sm text-white bg-rose-600 transition-colors hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            确认删除
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
