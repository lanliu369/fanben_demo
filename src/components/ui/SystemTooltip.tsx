'use client';

import { useId, useState, type ReactNode } from 'react';
import { systemUi } from '@/lib/systemUi';

type Placement = 'top' | 'bottom';
type Align = 'start' | 'center';

type Props = {
  content: string;
  children: ReactNode;
  placement?: Placement;
  align?: Align;
  className?: string;
};

/** 系统标准悬停气泡（飞书 SaaS：白底、slate 边框、shadow-sm） */
export function SystemTooltip({
  content,
  children,
  placement = 'top',
  align = 'start',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const text = content?.trim();

  if (!text) return <>{children}</>;

  const positionClass = placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const alignClass = align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <span
      className={`relative inline-block max-w-full ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 ${alignClass} ${positionClass} ${systemUi.tooltip}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
