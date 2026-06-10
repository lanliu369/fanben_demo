'use client';

import type { MouseEvent, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** 点击蒙层关闭（不传则蒙层不可点击关闭） */
  onBackdropClick?: () => void;
  className?: string;
  zClassName?: string;
};

/**
 * 弹窗标准蒙层：半透明遮罩 + 居中内容区
 * 蒙层 z-0、内容 z-10，避免遮罩挡住弹窗内按钮/输入框
 */
export function ModalOverlay({
  children,
  onBackdropClick,
  className = '',
  zClassName = 'z-50',
}: Props) {
  const stopBubble = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`fixed inset-0 isolate ${zClassName} ${className}`.trim()}
      onClick={onBackdropClick}
      role="presentation"
    >
      <div
        className="absolute inset-0 z-0 bg-black/50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        aria-hidden
      />
      <div
        className="relative z-10 flex min-h-full w-full items-center justify-center p-4 box-border"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="flex w-full justify-center"
          style={{ pointerEvents: 'auto' }}
          onClick={stopBubble}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
