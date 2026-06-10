'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { categoryUi } from '@/components/classification/category-ui';

export type CategoryDropdownMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type Props = {
  trigger: ReactNode;
  items: CategoryDropdownMenuItem[];
  align?: 'left' | 'right';
};

/**
 * 招采分类页标准下拉菜单（绝对定位浮层，避免挤入 flex 布局）
 */
export function CategoryDropdownMenu({ trigger, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', close);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  if (items.length === 0) return <>{trigger}</>;

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={rootRef} className="relative inline-block shrink-0">
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={`absolute ${alignClass} top-full z-[100] mt-1 ${categoryUi.dropdownPanel}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? categoryUi.dropdownItemDanger : categoryUi.dropdownItem}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
