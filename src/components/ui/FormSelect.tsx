'use client';

import { ChevronDown } from 'lucide-react';
import type { CSSProperties, SelectHTMLAttributes } from 'react';

const SIZE = {
  md: {
    selectClass: 'h-9 pl-3 text-sm rounded-lg',
    paddingRight: '2.25rem',
    iconRight: 10,
    iconSize: 16,
  },
  sm: {
    selectClass: 'h-8 pl-3 text-sm rounded-lg',
    paddingRight: '2rem',
    iconRight: 8,
    iconSize: 14,
  },
  xs: {
    selectClass: 'h-7 pl-2 text-xs rounded-md',
    paddingRight: '1.75rem',
    iconRight: 6,
    iconSize: 12,
  },
} as const;

export type FormSelectSize = keyof typeof SIZE;

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  /** 外层容器（宽度、mt-1 等） */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  selectSize?: FormSelectSize;
};

function joinClasses(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

const selectBaseStyle: CSSProperties = {
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  backgroundImage: 'none',
};

/** 业务表单下拉：箭头固定在内侧右侧（不依赖 Tailwind right/pr 是否生成） */
export function FormSelect({
  className,
  wrapperClassName,
  wrapperStyle,
  selectSize = 'md',
  disabled,
  children,
  style,
  ...props
}: Props) {
  const s = SIZE[selectSize];
  return (
    <div
      className={joinClasses('relative', wrapperClassName ?? 'w-full')}
      style={wrapperStyle}
    >
      <select
        disabled={disabled}
        className={joinClasses(
          'no-saas-select w-full appearance-none border border-slate-200 bg-white text-slate-700 outline-none transition-colors',
          '[-webkit-appearance:none] [background-image:none]',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          s.selectClass,
          className,
        )}
        style={{
          ...selectBaseStyle,
          paddingRight: s.paddingRight,
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={joinClasses(
          'pointer-events-none text-slate-400',
          disabled && 'opacity-50',
        )}
        style={{
          position: 'absolute',
          right: s.iconRight,
          top: '50%',
          transform: 'translateY(-50%)',
          width: s.iconSize,
          height: s.iconSize,
        }}
      />
    </div>
  );
}
